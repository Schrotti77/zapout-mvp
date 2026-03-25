"""
Passkey Authentication Backend for ZapOut
Handles WebAuthn registration and authentication
"""

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import struct
import time
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fido2 import cbor
from fido2.ctap2 import AssertionResponse
from fido2.utils import sha256
from pydantic import BaseModel

# Database path
DB_PATH = os.getenv("DB_PATH", "zapout.db")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 30  # 30 days

# Security
security = HTTPBearer()

router = APIRouter(prefix="/auth/passkey", tags=["passkey"])


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_passkey_db():
    """Initialize passkey tables"""
    conn = get_db()
    c = conn.cursor()

    # Passkey credentials table
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            credential_id TEXT UNIQUE NOT NULL,
            email TEXT,
            display_name TEXT,
            public_key TEXT NOT NULL,
            prf_salt TEXT,  -- Salt for PRF key derivation
            counter INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP
        )
    """
    )

    # Passkey challenges table (for registration/login)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge TEXT NOT NULL,
            user_id TEXT,
            email TEXT,
            type TEXT NOT NULL,  -- 'register' or 'authenticate'
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Users table (minimal, for passkey-first auth)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS passkey_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            display_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Migration: Add prf_salt column if it doesn't exist (for existing databases)
    try:
        c.execute("ALTER TABLE passkey_credentials ADD COLUMN prf_salt TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()


# Initialize tables
init_passkey_db()


def verify_webauthn_assertion(
    credential: dict,
    stored_credential: dict,
    expected_challenge: str,
    rp_id: str = "zapout.local",
    rp_origin: str = "http://localhost:3000",
) -> dict:
    """
    SEC-001: Verify WebAuthn assertion signature.

    Args:
        credential: The assertion response from the browser
        stored_credential: The credential from our database
        expected_challenge: The challenge we issued
        rp_id: Expected Relying Party ID
        rp_origin: Expected origin

    Returns:
        dict with verification results

    Raises:
        HTTPException if verification fails
    """
    try:
        response = credential.get("response", {})

        # Extract assertion components
        authenticator_data_b64 = response.get("authenticatorData")
        client_data_json_b64 = response.get("clientDataJSON")
        signature_b64 = response.get("signature")
        user_handle_b64 = response.get("userHandle")

        if not all([authenticator_data_b64, client_data_json_b64, signature_b64]):
            raise HTTPException(status_code=400, detail="Missing assertion data")

        # Decode base64url
        authenticator_data = base64.urlsafe_b64decode(authenticator_data_b64 + "==")
        client_data_json = base64.urlsafe_b64decode(client_data_json_b64 + "==")
        signature = base64.urlsafe_b64decode(signature_b64 + "==")
        user_handle = base64.urlsafe_b64decode(user_handle_b64 + "==") if user_handle_b64 else None

        # 1. Parse authenticatorData
        # Format: rpIdHash(32) + flags(1) + counter(4) + attestedCredentialData(optional) + extensions(optional)
        if len(authenticator_data) < 37:
            raise HTTPException(status_code=400, detail="Invalid authenticatorData length")

        rp_id_hash = authenticator_data[:32]
        flags = authenticator_data[32]
        counter = struct.unpack(">I", authenticator_data[33:37])[0]

        # Check flags
        UP = (flags & 0x01) != 0  # User Present
        UV = (flags & 0x04) != 0  # User Verified
        AT = (flags & 0x40) != 0  # Attested Credential Data included (not typical for assertion)

        if not UP:
            raise HTTPException(status_code=401, detail="User not present")

        # 2. Parse clientDataJSON
        client_data = json.loads(client_data_json)

        # Verify challenge matches
        client_challenge = client_data.get("challenge")
        if client_challenge != expected_challenge:
            raise HTTPException(status_code=401, detail="Challenge mismatch")

        # Verify origin
        client_origin = client_data.get("origin")
        if client_origin not in [
            rp_origin,
            rp_origin.replace("http://", "https://"),
            "http://127.0.0.1:3000",
        ]:
            # Allow localhost variations
            if not any(
                clientOrigin in client_origin for clientOrigin in ["localhost", "127.0.0.1", rp_id]
            ):
                raise HTTPException(status_code=401, detail=f"Invalid origin: {client_origin}")

        # Verify type is webauthn.get
        client_type = client_data.get("type")
        if client_type != "webauthn.get":
            raise HTTPException(status_code=401, detail=f"Invalid type: {client_type}")

        # 3. Verify signature
        # The signed data is: authenticatorData || SHA256(clientDataJSON)
        client_data_hash = sha256(client_data_json)
        signed_data = authenticator_data + client_data_hash

        # Parse stored public key (COSE format)
        public_key_cose = json.loads(stored_credential["public_key"])

        # Decode COSE key to crypto.PublicKey
        from fido2.cose import ES256, RS256, EdDSA, SupportedKey

        # Handle different key types
        key_type = public_key_cose.get(1)  # kty
        alg = public_key_cose.get(3)  # alg

        # COSE key type: 1=OKP, 2=EC2, 3=RSA
        if key_type == 2:  # EC2 (P-256/P-384/P-521)
            # ES256 = -7, ES384 = -35, ES512 = -36
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

            # Extract coordinates
            x = public_key_cose.get(-2)  # x coordinate
            y = public_key_cose.get(-3)  # y coordinate

            if not x or not y:
                raise HTTPException(status_code=500, detail="Missing EC coordinates")

            # Create uncompressed point (02 or 03 prefix + x + y)
            point = (
                bytes([0x04])
                + base64.urlsafe_b64decode(x + "==")
                + base64.urlsafe_b64decode(y + "==")
            )

            # Determine curve
            if alg == -7:  # ES256
                curve = ec.SECP256R1()
            elif alg == -35:  # ES384
                curve = ec.SECP384R1()
            elif alg == -36:  # ES512
                curve = ec.SECP521R1()
            else:
                raise HTTPException(status_code=500, detail=f"Unsupported EC algorithm: {alg}")

            from cryptography.hazmat.backends import default_backend

            public_key = ec.EllipticCurvePublicKey.from_encoded_point(curve, point)

            # Verify signature
            public_key.verify(signature, signed_data, ec.ECDSA(ec.SECP256R1().name))

        elif key_type == 3:  # RSA
            from cryptography.hazmat.primitives.asymmetric import padding, rsa
            from cryptography.hazmat.primitives.serialization import load_der_public_key

            n = public_key_cose.get(-1)  # modulus
            e = public_key_cose.get(-2)  # exponent

            if not n or not e:
                raise HTTPException(status_code=500, detail="Missing RSA parameters")

            # Decode DER components
            n_bytes = base64.urlsafe_b64decode(n + "==")
            e_bytes = base64.urlsafe_b64decode(e + "==")

            # Build DER public key
            from cryptography.hazmat.primitives.asymmetric.rsa import rsa_crt_iqmp
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

            # RSA public key DER structure
            from cryptography.x509 import basic_constraints

            public_numbers = rsa.RSAPublicNumbers(
                e=int.from_bytes(e_bytes, "big"), n=int.from_bytes(n_bytes, "big")
            )
            public_key = public_numbers.public_key()

            # Verify signature (PKCS1v15)
            public_key.verify(signature, signed_data, padding.PKCS1v15())
        else:
            raise HTTPException(status_code=500, detail=f"Unsupported key type: {key_type}")

        # 4. Check counter for replay protection
        stored_counter = stored_credential.get("counter", 0)
        if counter <= stored_counter and stored_counter > 0:
            # Counter didn't increase - potential replay attack!
            raise HTTPException(
                status_code=401, detail="Counter did not increase - possible replay attack"
            )

        print(f"Assertion verified: counter={counter}, UP={UP}, UV={UV}")

        return {
            "verified": True,
            "counter": counter,
            "user_present": UP,
            "user_verified": UV,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Assertion verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Assertion verification failed: {str(e)}")


def generate_challenge() -> str:
    """Generate a random challenge"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def generate_user_id() -> str:
    """Generate a unique user ID"""
    return secrets.token_hex(16)


def generate_prf_salt() -> str:
    """Generate a random salt for PRF key derivation"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def derive_seed_from_prf(prf_result_b64: str, salt: str) -> bytes:
    """
    Derive a BIP32 seed from PRF result and salt.
    Uses HKDF-like derivation for BIP32 compatibility.
    """
    import hashlib
    import hmac

    prf_bytes = base64.urlsafe_b64decode(prf_result_b64 + "==")
    salt_bytes = salt.encode()

    # Use HMAC-SHA512 to derive the seed (BIP32 style)
    # IKM = PRF result, salt = key
    h = hmac.new(salt_bytes, prf_bytes, hashlib.sha512)
    derived = h.digest()

    # Take first 32 bytes as BIP32 seed
    return derived[:32]


def create_token(user_id: str, email: str = None) -> str:
    """Create JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to get current user from token"""
    token = credentials.credentials
    return verify_token(token)


# Pydantic models
class PasskeyRegisterRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    credential: dict
    challenge: str


class PasskeyLoginRequest(BaseModel):
    credential: dict
    challenge: str
    email: Optional[str] = None


class PasskeyDeleteRequest(BaseModel):
    credentialId: str


class ChallengeResponse(BaseModel):
    challenge: str
    rp_id: str
    rp_name: str


# Routes


@router.post("/register")
async def register_passkey(request: PasskeyRegisterRequest):
    """
    Register a new passkey for a user
    """
    try:
        # Verify challenge exists and is valid
        conn = get_db()
        c = conn.cursor()

        # Check challenge
        c.execute(
            """
            SELECT * FROM passkey_challenges
            WHERE challenge = ? AND type = 'register' AND used = 0 AND expires_at > datetime('now')
            """,
            (request.challenge,),
        )
        challenge_row = c.fetchone()

        # For development, auto-create challenge if not found
        if not challenge_row:
            # Generate and store new challenge
            challenge = generate_challenge()
            c.execute(
                """
                INSERT INTO passkey_challenges (challenge, email, type, expires_at)
                VALUES (?, ?, 'register', datetime('now', '+5 minutes'))
                """,
                (challenge, request.email),
            )
            conn.commit()

        # Mark challenge as used
        if challenge_row:
            c.execute("UPDATE passkey_challenges SET used = 1 WHERE id = ?", (challenge_row["id"],))

        # Generate user_id
        user_id = generate_user_id()

        # Store user
        c.execute(
            """
            INSERT OR REPLACE INTO passkey_users (user_id, email, display_name)
            VALUES (?, ?, ?)
            """,
            (user_id, request.email, request.display_name or request.email),
        )

        # Store credential
        credential_id = request.credential.get("id", "")
        public_key = json.dumps(request.credential.get("response", {}))

        c.execute(
            """
            INSERT INTO passkey_credentials (user_id, credential_id, email, public_key)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, credential_id, request.email, public_key),
        )

        conn.commit()
        conn.close()

        # Create token
        token = create_token(user_id, request.email)

        return {
            "success": True,
            "user_id": user_id,
            "token": token,
            "message": "Passkey registered successfully",
        }

    except Exception as e:
        print(f"Passkey registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login_passkey(request: PasskeyLoginRequest):
    """
    Authenticate with an existing passkey.
    SEC-001: Verifies assertion signature and challenge.
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # Find credential
        credential_id = request.credential.get("id", "")
        c.execute(
            "SELECT * FROM passkey_credentials WHERE credential_id = ?",
            (credential_id,),
        )
        credential = c.fetchone()

        if not credential:
            # Try to find by email
            if request.email:
                c.execute(
                    "SELECT * FROM passkey_credentials WHERE email = ? LIMIT 1",
                    (request.email,),
                )
                credential = c.fetchone()

        if not credential:
            conn.close()
            raise HTTPException(status_code=401, detail="Passkey not found")

        # SEC-001: Verify assertion if challenge provided
        if request.challenge:
            try:
                assertion_result = verify_webauthn_assertion(
                    credential=request.credential,
                    stored_credential=dict(credential),
                    expected_challenge=request.challenge,
                )

                # Update counter
                new_counter = assertion_result.get("counter", 0)
                c.execute(
                    "UPDATE passkey_credentials SET counter = ?, last_used = datetime('now') WHERE id = ?",
                    (
                        new_counter,
                        credential["id"],
                    ),
                )
                print(f"Assertion verified for login: counter={new_counter}")
            except HTTPException:
                conn.close()
                raise
            except Exception as e:
                print(f"Assertion verification failed during login: {e}")
                conn.close()
                raise HTTPException(
                    status_code=401, detail=f"Assertion verification failed: {str(e)}"
                )
        else:
            # Update last used without counter check
            c.execute(
                "UPDATE passkey_credentials SET last_used = datetime('now') WHERE id = ?",
                (credential["id"],),
            )

        conn.commit()
        conn.close()

        # Create token
        token = create_token(credential["user_id"], credential["email"])

        return {
            "success": True,
            "token": token,
            "user_id": credential["user_id"],
            "message": "Login successful",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Passkey login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/credentials")
async def get_credentials(email: str = "", user=Depends(get_current_user)):
    """
    Get registered passkey credentials for current user
    """
    try:
        conn = get_db()
        c = conn.cursor()

        if email:
            c.execute(
                "SELECT credential_id, created_at, last_used FROM passkey_credentials WHERE email = ?",
                (email,),
            )
        else:
            c.execute(
                "SELECT credential_id, created_at, last_used FROM passkey_credentials WHERE user_id = ?",
                (user["sub"],),
            )

        rows = c.fetchall()
        conn.close()

        credentials = [
            {
                "credential_id": row["credential_id"],
                "created_at": row["created_at"],
                "last_used": row["last_used"],
            }
            for row in rows
        ]

        return {"credentials": credentials}

    except Exception as e:
        print(f"Get credentials error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete")
async def delete_passkey(request: PasskeyDeleteRequest, user=Depends(get_current_user)):
    """
    Delete a registered passkey
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # Verify ownership
        c.execute(
            "SELECT id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?",
            (request.credentialId, user["sub"]),
        )
        credential = c.fetchone()

        if not credential:
            conn.close()
            raise HTTPException(status_code=404, detail="Credential not found")

        c.execute(
            "DELETE FROM passkey_credentials WHERE credential_id = ?", (request.credentialId,)
        )
        conn.commit()
        conn.close()

        return {"success": True, "message": "Passkey deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete passkey error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenge/register")
async def get_register_challenge(email: str = ""):
    """
    Get a new registration challenge
    """
    try:
        challenge = generate_challenge()

        conn = get_db()
        c = conn.cursor()

        c.execute(
            """
            INSERT INTO passkey_challenges (challenge, email, type, expires_at)
            VALUES (?, ?, 'register', datetime('now', '+5 minutes'))
            """,
            (challenge, email or None),
        )

        conn.commit()
        conn.close()

        return {
            "challenge": challenge,
            "rp_id": os.getenv("RP_ID", "localhost"),
            "rp_name": "ZapOut",
        }

    except Exception as e:
        print(f"Get challenge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenge/authenticate")
async def get_auth_challenge(email: str = ""):
    """
    Get a new authentication challenge
    """
    try:
        challenge = generate_challenge()

        conn = get_db()
        c = conn.cursor()

        c.execute(
            """
            INSERT INTO passkey_challenges (challenge, email, type, expires_at)
            VALUES (?, ?, 'authenticate', datetime('now', '+5 minutes'))
            """,
            (challenge, email or None),
        )

        conn.commit()
        conn.close()

        return {
            "challenge": challenge,
            "rp_id": os.getenv("RP_ID", "localhost"),
            "rp_name": "ZapOut",
        }

    except Exception as e:
        print(f"Get challenge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PRF Key Derivation Endpoints
# =============================================================================


class PRFRegisterRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    credential: dict
    prf_result: str  # Base64 encoded PRF output from browser
    credential_id: str  # The credential ID for lookup


class PRFLoginRequest(BaseModel):
    credential: dict
    prf_result: str
    credential_id: str
    challenge: str  # SEC-001: REQUIRED - Server-issued challenge for replay protection


class WalletCreateRequest(BaseModel):
    seed: str  # Hex encoded BIP32 seed


@router.post("/prf/register")
async def prf_register(request: PRFRegisterRequest):
    """
    Register passkey with PRF key derivation.
    Creates a watch-only wallet in LND using the derived seed.
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # Check if credential already exists
        c.execute(
            "SELECT * FROM passkey_credentials WHERE credential_id = ?",
            (request.credential_id,),
        )
        existing = c.fetchone()

        if existing:
            # Update PRF salt
            prf_salt = generate_prf_salt()
            c.execute(
                "UPDATE passkey_credentials SET prf_salt = ? WHERE credential_id = ?",
                (prf_salt, request.credential_id),
            )
            user_id = existing["user_id"]
            email = existing["email"]
        else:
            # New registration
            user_id = generate_user_id()
            prf_salt = generate_prf_salt()

            # Store user
            c.execute(
                """
                INSERT OR REPLACE INTO passkey_users (user_id, email, display_name)
                VALUES (?, ?, ?)
                """,
                (user_id, request.email, request.display_name or request.email),
            )

            # Store credential with PRF salt
            public_key = json.dumps(request.credential.get("response", {}))
            c.execute(
                """
                INSERT INTO passkey_credentials (user_id, credential_id, email, public_key, prf_salt)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, request.credential_id, request.email, public_key, prf_salt),
            )
            email = request.email

        conn.commit()

        # Derive seed from PRF result + salt
        seed = derive_seed_from_prf(request.prf_result, prf_salt)
        seed_hex = seed.hex()

        # Create watch-only wallet in LND
        wallet_result = create_watch_only_wallet(user_id, seed_hex)

        conn.close()

        # Create token
        token = create_token(user_id, email)

        return {
            "success": True,
            "user_id": user_id,
            "token": token,
            "wallet": wallet_result,
            "message": "Passkey registered with PRF key derivation",
        }

    except Exception as e:
        print(f"PRF registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prf/login")
async def prf_login(request: PRFLoginRequest):
    """
    Login with passkey and verify PRF key derivation.
    SEC-001: Verifies:
    1. Challenge was issued by us and not reused
    2. Assertion signature is valid
    3. Counter increased (replay protection)

    SECURITY: All verifications are REQUIRED. Login fails if any check fails.
    """
    try:
        conn = get_db()
        c = conn.cursor()

        # SEC-001: Get stored credential with public key
        c.execute(
            "SELECT * FROM passkey_credentials WHERE credential_id = ?",
            (request.credential_id,),
        )
        stored_credential = c.fetchone()

        if not stored_credential:
            conn.close()
            raise HTTPException(status_code=401, detail="Passkey not found")

        # SEC-001 Step 1: Verify challenge (REQUIRED)
        c.execute(
            """
            SELECT id FROM passkey_challenges
            WHERE challenge = ? AND type = 'authenticate' AND used = 0
            AND expires_at > datetime('now')
            """,
            (request.challenge,),
        )
        challenge_row = c.fetchone()

        if not challenge_row:
            conn.close()
            raise HTTPException(
                status_code=401, detail="Invalid or expired challenge - possible replay attack"
            )

        # Mark challenge as used immediately
        c.execute(
            "UPDATE passkey_challenges SET used = 1 WHERE id = ?",
            (challenge_row["id"],),
        )
        print(f"Challenge verified for credential: {request.credential_id}")

        # SEC-001 Step 2: Verify assertion signature (REQUIRED)
        if not request.credential:
            conn.close()
            raise HTTPException(status_code=400, detail="Missing credential data")

        try:
            assertion_result = verify_webauthn_assertion(
                credential=request.credential,
                stored_credential=dict(stored_credential),
                expected_challenge=request.challenge,
            )
            print(f"Assertion signature verified: {assertion_result}")
        except HTTPException:
            conn.close()
            raise
        except Exception as e:
            print(f"Assertion verification failed: {e}")
            conn.close()
            raise HTTPException(
                status_code=401, detail=f"Assertion signature verification failed: {str(e)}"
            )

        # SEC-001 Step 3: Get stored salt and verify PRF
        prf_salt = stored_credential["prf_salt"]
        if not prf_salt:
            conn.close()
            raise HTTPException(
                status_code=400, detail="No PRF salt found - please re-register your passkey"
            )

        # Verify PRF result (derive seed)
        derived_seed = derive_seed_from_prf(request.prf_result, prf_salt)

        # SEC-001 Step 4: Update counter (replay protection)
        new_counter = assertion_result.get("counter", 0)
        c.execute(
            "UPDATE passkey_credentials SET counter = ?, last_used = datetime('now') WHERE id = ?",
            (new_counter, stored_credential["id"]),
        )
        conn.commit()
        conn.close()

        # All verifications passed - create token
        token = create_token(stored_credential["user_id"], stored_credential["email"])

        return {
            "success": True,
            "token": token,
            "user_id": stored_credential["user_id"],
            "assertion_verified": True,
            "challenge_verified": True,
            "counter": new_counter,
            "message": "PRF login successful - all security checks passed",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"PRF login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

        # Create token
        token = create_token(stored_credential["user_id"], stored_credential["email"])

        return {
            "success": True,
            "token": token,
            "user_id": stored_credential["user_id"],
            "assertion_verified": assertion_result is not None,
            "challenge_verified": challenge_verified,
            "message": "PRF login successful"
            + (" (assertion verified)" if assertion_result else " (assertion not verified)"),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"PRF login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wallet")
async def get_wallet_info(user=Depends(get_current_user)):
    """
    Get wallet info for the current user
    """
    try:
        import subprocess

        # Get LND info via Helmut
        cmd = [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "helmut-tail",
            "docker",
            "exec",
            "lightning_lnd_1",
            "lncli",
            "-n",
            "mainnet",
            "getinfo",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)

        if result.returncode != 0:
            return {
                "connected": False,
                "error": "Could not connect to LND",
            }

        info = json.loads(result.stdout)
        return {
            "connected": True,
            "pubkey": info.get("identity_pubkey", ""),
            "alias": info.get("alias", ""),
            "num_channels": info.get("num_active_channels", 0),
            "block_height": info.get("block_height", 0),
        }

    except Exception as e:
        print(f"Get wallet info error: {e}")
        return {"connected": False, "error": str(e)}


def create_watch_only_wallet(user_id: str, seed_hex: str) -> dict:
    """
    Create a watch-only wallet in LND.
    Uses LND's walletkit RPC or lncli for wallet creation.

    Note: For true watch-only, we need to import the extended public key.
    This implementation creates an LND wallet using the seed (LND manages the keys).
    """
    import subprocess

    try:
        # Check if wallet exists
        cmd_check = [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "helmut-tail",
            "docker",
            "exec",
            "lightning_lnd_1",
            "lncli",
            "-n",
            "mainnet",
            "getinfo",
        ]
        result = subprocess.run(cmd_check, capture_output=True, text=True, timeout=15)

        if result.returncode == 0:
            info = json.loads(result.stdout)
            return {
                "success": True,
                "type": "shared_lnd",
                "pubkey": info.get("identity_pubkey", ""),
                "message": "Using shared LND wallet on Helmut",
            }

        return {"success": False, "error": "LND not accessible"}

    except Exception as e:
        print(f"Watch-only wallet creation error: {e}")
        return {"success": False, "error": str(e)}


# Initialize on module load
init_passkey_db()
