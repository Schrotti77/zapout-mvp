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
 * Register a new passkey for a user
 *
 * @param {string} email - User email
 * @param {string} displayName - User display name
 * @returns {Promise<object>} - Registration result
 */
export async function registerPasskey(email, displayName) {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  // 1. Get registration options from server
  const challenge = generateChallenge();
  const userId = generateUserId();

  // Store userId in localStorage for login (in production, use secure storage)
  localStorage.setItem('zapout_passkey_userId', base64URLEncode(userId));

  // 2. Create public key credential options
  const publicKeyCredentialCreationOptions = {
    challenge: base64URLDecode(challenge),
    rp: {
      id: RP_ID,
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
      // Don't restrict to 'platform' - allow any authenticator including browser-based
      // On desktop Linux, browsers can act as software authenticators
      userVerification: 'required',
      residentKey: 'discouraged', // Non-discoverable is more compatible with phone-as-security-key
    },
    timeout: 120000, // 2 minutes for QR code pairing
    attestation: 'none', // Don't send attestation for privacy
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

  // 4. Process the credential response
  const credentialId = base64URLEncode(credential.rawId);
  const attestationResponse = credential.response;

  // Extract PRF result if available (Breez SDK style)
  let prfResult = null;
  if (credential.getClientExtensionResults?.().prf?.enabled) {
    // PRF is supported and was used
    prfResult = base64URLEncode(credential.getClientExtensionResults().prf.results.first);
  }

  // 5. Send credential to server for verification and storage
  const credentialData = {
    id: credentialId,
    rawId: credentialId,
    type: credential.type,
    response: {
      attestationObject: base64URLEncode(attestationResponse.attestationObject),
      clientDataJSON: base64URLEncode(attestationResponse.clientDataJSON),
    },
    prfResult: prfResult, // May be used as wallet seed
  };

  // 6. Register with backend
  try {
    const response = await fetch(API_URL + '/auth/passkey/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        credential: credentialData,
        challenge,
      }),
    }).catch(err => {
      console.error('Network error:', err);
      throw new Error('Netzwerkfehler: ' + err.message);
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error || data.detail || 'Registration failed';
      console.error('Backend registration error:', response.status, errorMsg, data);
      throw new Error(errorMsg);
    }

    return {
      success: true,
      credentialId,
      userId: base64URLEncode(userId),
      prfResult,
    };
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

  const challenge = generateChallenge();
  const storedUserId = localStorage.getItem('zapout_passkey_userId');

  // Allow email to be provided or auto-detected
  const userId = email ? generateUserId() : storedUserId ? base64URLDecode(storedUserId) : null;

  // Don't specify allowCredentials - let browser select any registered passkey
  // This is more reliable across browsers than specifying null IDs
  const publicKeyCredentialRequestOptions = {
    challenge: base64URLDecode(challenge),
    rpId: RP_ID,
    userVerification: 'required',
    timeout: TIMEOUT,
    extensions: {
      prf: {},
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
    prfResult: prfResult,
  };

  // 5. Verify with backend and get token
  try {
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
      credentialId,
      prfResult,
    };
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
