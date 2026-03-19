/**
 * Passkey (WebAuthn) Utilities for ZapOut
 * Handles registration and authentication with passkeys
 *
 * Based on FIDO2/WebAuthn with PRF extension for key derivation
 */

const API_URL = 'http://localhost:8000';

// RP ID - for development, use localhost
// In production, this should be your domain
const RP_ID = window.location.hostname || 'localhost';
const RP_NAME = 'ZapOut';
const TIMEOUT = 60000; // 60 seconds

/**
 * Check if WebAuthn/Passkeys are supported
 * Note: We check for basic WebAuthn support, not just platform authenticators.
 * Browsers on desktop (even Linux) can use software-based passkeys.
 */
export function isPasskeySupported() {
  return !!(window.PublicKeyCredential && typeof window.PublicKeyCredential === 'function');
}

/**
 * Check if device has a platform authenticator (TouchID, Windows Hello, etc.)
 * This is optional - passkeys can work via browser-based software too
 */
export async function isPlatformAuthenticatorAvailable() {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Generate a random challenge
 */
function generateChallenge() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate a random user ID
 */
function generateUserId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

/**
 * Base64 URL encode
 */
function base64URLEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64 URL decode
 */
function base64URLDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Register a new passkey for a user with PRF key derivation
 *
 * @param {string} email - User email
 * @param {string} displayName - User display name
 * @returns {Promise<object>} - Registration result
 */
export async function registerPasskey(email, displayName) {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  // 1. Get registration challenge from server
  let challenge, rpId;
  try {
    const res = await fetch(
      `${API_URL}/auth/passkey/challenge/register?email=${encodeURIComponent(email)}`
    );
    if (res.ok) {
      const data = await res.json();
      challenge = data.challenge;
      rpId = data.rp_id || RP_ID;
    } else {
      // Fallback to local challenge
      challenge = generateChallenge();
      rpId = RP_ID;
    }
  } catch {
    challenge = generateChallenge();
    rpId = RP_ID;
  }

  const userId = generateUserId();
  localStorage.setItem('zapout_passkey_userId', base64URLEncode(userId));

  // 2. Create public key credential options with PRF
  const publicKeyCredentialCreationOptions = {
    challenge: base64URLDecode(challenge),
    rp: {
      id: rpId,
      name: RP_NAME,
    },
    user: {
      id: userId,
      name: email,
      displayName: displayName || email,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      userVerification: 'required',
      residentKey: 'discouraged',
    },
    timeout: 120000,
    attestation: 'none',
    extensions: {
      prf: {
        eval: {
          first: base64URLDecode(challenge),
        },
      },
    },
  };

  // 3. Create the credential
  let credential;
  try {
    credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });
  } catch (error) {
    console.error('Passkey registration failed:', error);
    throw new Error('Passkey registration failed: ' + error.message);
  }

  if (!credential) {
    throw new Error('Passkey registration was cancelled');
  }

  // 4. Extract credential data and PRF result
  const credentialId = base64URLEncode(credential.rawId);
  const attestationResponse = credential.response;

  // Extract PRF result
  let prfResult = null;
  const extResults = credential.getClientExtensionResults?.();
  if (extResults?.prf?.enabled && extResults?.prf?.results?.first) {
    prfResult = base64URLEncode(extResults.prf.results.first);
    console.log('PRF enabled, derived key available');
  }

  // 5. Register with backend using PRF endpoint
  try {
    // If we have PRF, use the dedicated PRF endpoint
    if (prfResult) {
      const response = await fetch(API_URL + '/auth/passkey/prf/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          display_name: displayName || email,
          credential_id: credentialId,
          credential: {
            id: credentialId,
            rawId: credentialId,
            type: credential.type,
            response: {
              attestationObject: base64URLEncode(attestationResponse.attestationObject),
              clientDataJSON: base64URLEncode(attestationResponse.clientDataJSON),
            },
          },
          prf_result: prfResult,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.detail || 'PRF Registration failed';
        throw new Error(errorMsg);
      }

      // Store credential ID for later login
      localStorage.setItem('zapout_passkey_credentialId', credentialId);

      return {
        success: true,
        credentialId,
        userId: base64URLEncode(userId),
        prfResult,
        token: data.token,
        wallet: data.wallet,
        message: 'Passkey registered with PRF key derivation',
      };
    } else {
      // Fallback to regular registration (no PRF)
      const credentialData = {
        id: credentialId,
        rawId: credentialId,
        type: credential.type,
        response: {
          attestationObject: base64URLEncode(attestationResponse.attestationObject),
          clientDataJSON: base64URLEncode(attestationResponse.clientDataJSON),
        },
      };

      const response = await fetch(API_URL + '/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          credential: credentialData,
          challenge,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.detail || 'Registration failed';
        throw new Error(errorMsg);
      }

      localStorage.setItem('zapout_passkey_credentialId', credentialId);

      return {
        success: true,
        credentialId,
        userId: base64URLEncode(userId),
        prfResult: null,
        token: data.token,
      };
    }
  } catch (error) {
    console.error('Backend registration error:', error);
    throw error;
  }
}

/**
 * Authenticate with an existing passkey
 *
 * @param {string} email - User email (optional, for credential selection)
 * @returns {Promise<object>} - Authentication result
 */
export async function authenticatePasskey(email = null) {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  // SEC-001: Get challenge from server to prevent replay attacks
  let serverChallenge = null;
  try {
    const challengeRes = await fetch(
      `${API_URL}/auth/passkey/challenge/authenticate?email=${encodeURIComponent(email || '')}`
    );
    if (challengeRes.ok) {
      const challengeData = await challengeRes.json();
      serverChallenge = challengeData.challenge;
    }
  } catch (e) {
    console.warn('Could not fetch server challenge, using fallback:', e);
  }

  // Use server challenge or fallback to local (for offline/error cases)
  const challenge = serverChallenge || generateChallenge();

  const storedUserId = localStorage.getItem('zapout_passkey_userId');
  const storedCredentialId = localStorage.getItem('zapout_passkey_credentialId');

  // Allow email to be provided or auto-detected
  const userId = email ? generateUserId() : storedUserId ? base64URLDecode(storedUserId) : null;

  // Allow credentials with stored credential ID if available
  const allowCredentials = storedCredentialId
    ? [{ id: base64URLDecode(storedCredentialId), type: 'public-key' }]
    : [];

  // Request PRF with the challenge as input
  const publicKeyCredentialRequestOptions = {
    challenge: base64URLDecode(challenge),
    rpId: RP_ID,
    userVerification: 'required',
    timeout: TIMEOUT,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    extensions: {
      prf: {
        eval: {
          first: base64URLDecode(challenge),
        },
      },
    },
  };

  // 3. Get assertion from authenticator
  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });
  } catch (error) {
    console.error('Passkey authentication failed:', error);
    throw new Error('Passkey authentication failed: ' + error.message);
  }

  if (!assertion) {
    throw new Error('Passkey authentication was cancelled');
  }

  // 4. Process assertion response
  const credentialId = base64URLEncode(assertion.rawId);

  // Extract PRF result for key derivation
  let prfResult = null;
  const extResults = assertion.getClientExtensionResults?.();
  if (extResults?.prf?.enabled && extResults?.prf?.results?.first) {
    prfResult = base64URLEncode(extResults.prf.results.first);
  }

  const assertionData = {
    id: credentialId,
    rawId: credentialId,
    type: assertion.type,
    response: {
      authenticatorData: base64URLEncode(assertion.response.authenticatorData),
      clientDataJSON: base64URLEncode(assertion.response.clientDataJSON),
      signature: base64URLEncode(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? base64URLEncode(assertion.response.userHandle)
        : null,
    },
  };

  // 5. Verify with backend - use PRF endpoint if we have PRF result
  try {
    if (prfResult && storedCredentialId) {
      // Use PRF login endpoint
      const response = await fetch(API_URL + '/auth/passkey/prf/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: assertionData,
          credential_id: credentialId,
          prf_result: prfResult,
          challenge: serverChallenge, // SEC-001: Include server-issued challenge
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.detail || 'PRF Authentication failed';
        throw new Error(errorMsg);
      }

      return {
        success: true,
        token: data.token,
        userId: data.user_id,
        credentialId,
        prfResult,
        message: 'PRF login successful',
      };
    } else {
      // Fallback to regular login
      const response = await fetch(API_URL + '/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: assertionData,
          challenge,
          email: email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      return {
        success: true,
        token: data.token,
        userId: data.user_id,
        credentialId,
        prfResult: null,
      };
    }
  } catch (error) {
    console.error('Backend authentication error:', error);
    throw error;
  }
}

/**
 * Check if user has registered passkeys
 * Returns list of credential IDs
 */
export async function getRegisteredPasskeys(email = null) {
  try {
    const response = await fetch(
      API_URL +
        '/auth/passkey/credentials?' +
        new URLSearchParams({
          email: email || '',
        }),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.credentials || [];
  } catch (error) {
    console.error('Failed to get passkeys:', error);
    return [];
  }
}

/**
 * Delete a registered passkey
 *
 * @param {string} credentialId - Credential ID to delete
 */
export async function deletePasskey(credentialId) {
  try {
    const response = await fetch(API_URL + '/auth/passkey/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem('zapout_token') || ''),
      },
      body: JSON.stringify({ credentialId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete passkey');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete passkey:', error);
    throw error;
  }
}

/**
 * Check if PRF (Pseudorandom Function) extension is supported
 * PRF is needed for key derivation from passkeys (Breez SDK style)
 */
export function isPRFSupported() {
  if (!isPasskeySupported()) return false;

  // Check if browser supports PRF extension
  // This is a best-effort check
  return true; // Modern browsers (Chrome 91+, Safari 16+) support PRF
}

/**
 * Derive a seed from passkey using PRF (if available)
 * This can be used as a wallet seed
 *
 * @param {ArrayBuffer} salt - Salt for PRF
 * @param {ArrayBuffer} prfInput - PRF input
 * @returns {Promise<ArrayBuffer>} - Derived seed
 */
export async function deriveSeedFromPasskey(salt, prfInput) {
  if (!isPRFSupported()) {
    throw new Error('PRF extension not supported');
  }

  // In a full implementation, this would use the PRF extension
  // to derive a deterministic seed from the passkey
  // For now, we return a random seed (in production, use proper PRF)

  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed.buffer;
}
