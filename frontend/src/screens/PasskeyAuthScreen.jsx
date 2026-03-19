/**
 * PasskeyAuthScreen - Passkey Registration and Login
 *
 * Supports:
 * - Registration with email + passkey
 * - Login with existing passkey
 * - Multiple passkeys per account
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isPasskeySupported,
  registerPasskey,
  authenticatePasskey,
  getRegisteredPasskeys,
  isPRFSupported,
} from '../utils/passkey';

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  outline: 'none',
};

const btnPrimary = {
  background: 'linear-gradient(135deg, #f7931a 0%, #e5820a 100%)',
  color: '#000000',
  border: 'none',
  padding: '14px 24px',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
};

const btnSecondary = {
  backgroundColor: '#1a1a1a',
  color: '#f7931a',
  border: '1px solid #f7931a',
  padding: '14px 24px',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
};

const btnPasskey = {
  backgroundColor: '#2a2a2a',
  color: '#ffffff',
  border: '2px solid #f7931a',
  padding: '16px 24px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
};

// Passkey icon SVG
const PasskeyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C9.24 2 7 4.24 7 7C7 8.86 8.03 10.47 9.5 11.26V13.87C9.5 14.27 9.73 14.64 10.06 14.85C10.39 15.06 10.8 15.08 11.15 14.9L11.27 14.85H12.73L12.85 14.9C13.2 15.08 13.61 15.06 13.94 14.85C14.27 14.64 14.5 14.27 14.5 13.87V11.26C15.97 10.47 17 8.86 17 7C17 4.24 14.76 2 12 2ZM12 4C13.66 4 15 5.34 15 7C15 8.66 13.66 10 12 10C10.34 10 9 8.66 9 7C9 5.34 10.34 4 12 4ZM12 17C9.67 17 6.68 18.34 6.04 19H17.96C17.32 18.34 14.33 17 12 17Z"
      fill="#f7931a"
    />
    <circle cx="12" cy="7" r="2" fill="#f7931a" />
  </svg>
);

function PasskeyAuthScreen({ mode: initialMode, setScreen, onAuthSuccess, onSkip }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(initialMode || 'select'); // 'select', 'register', 'login'
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [hasRegisteredPasskeys, setHasRegisteredPasskeys] = useState(false);

  useEffect(() => {
    // Check passkey support
    setPasskeySupported(isPasskeySupported());

    // Check if user already has passkeys registered
    checkExistingPasskeys();
  }, []);

  const checkExistingPasskeys = async () => {
    try {
      const creds = await getRegisteredPasskeys();
      setHasRegisteredPasskeys(creds.length > 0);
    } catch (e) {
      console.log('No existing passkeys found');
    }
  };

  const handleRegister = async () => {
    if (!email) {
      setError(t('auth.email') + ' erforderlich');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await registerPasskey(email, displayName || email);

      if (result.success) {
        // Store credential ID for later logins
        localStorage.setItem('zapout_passkey_credential_id', result.credentialId);
        localStorage.setItem('zapout_passkey_email', email);

        // Try to get token from result (if backend returns it)
        // Otherwise, trigger a passkey login to get the token
        if (result.token) {
          localStorage.setItem('zapout_token', result.token);
          onAuthSuccess(result.token);
        } else {
          // Do a passkey login to get the token
          const loginResult = await authenticatePasskey(email);
          localStorage.setItem('zapout_token', loginResult.token);
          onAuthSuccess(loginResult.token);
        }
      }
    } catch (e) {
      console.error('Passkey registration error:', e);
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Try to use stored email first
      const storedEmail = localStorage.getItem('zapout_passkey_email') || email;
      const result = await authenticatePasskey(storedEmail);

      if (result.success && result.token) {
        localStorage.setItem('zapout_token', result.token);
        localStorage.setItem('zapout_passkey_email', storedEmail);
        onAuthSuccess(result.token);
      }
    } catch (e) {
      console.error('Passkey login error:', e);
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Fallback: Email-only registration (no passkey, for testing)
  const handleEmailFallbackRegister = async () => {
    if (!email) {
      setError(t('auth.email') + ' erforderlich');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: 'fallback-no-passkey', // Dummy password for fallback
          iban: '',
          phone: '',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('zapout_token', data.token);
      localStorage.setItem('zapout_passkey_email', email);
      localStorage.setItem('zapout_fallback_mode', 'true'); // Mark as fallback
      onAuthSuccess(data.token);
    } catch (e) {
      console.error('Email fallback registration error:', e);
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Mode: Select (choose between register or login)
  if (mode === 'select') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', padding: '20px' }}>
        <header
          style={{
            backgroundColor: '#0d0d0d',
            borderBottom: '1px solid #1a1a1a',
            padding: '20px',
            textAlign: 'center',
            margin: '-20px -20px 20px -20px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #f7931a, #ffa333)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('app.name')}
          </h1>
          <p style={{ color: '#666666', fontSize: '14px', marginTop: '4px' }}>{t('app.tagline')}</p>
        </header>

        <main style={{ maxWidth: '400px', margin: '40px auto 0' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '8px', textAlign: 'center' }}>
            Willkommen!
          </h2>
          <p style={{ color: '#888888', marginBottom: '32px', textAlign: 'center' }}>
            Melde dich an oder erstelle ein neues Konto
          </p>

          {!passkeySupported && (
            <div
              style={{
                backgroundColor: '#2a1a00',
                border: '1px solid #f7931a',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <p style={{ color: '#f7931a', fontSize: '14px' }}>
                ⚠️ Passkeys werden von diesem Browser nicht unterstützt. Bitte nutze Chrome, Safari
                oder Edge.
              </p>
            </div>
          )}

          {/* Login with Passkey Button */}
          {hasRegisteredPasskeys && passkeySupported && (
            <button style={btnPasskey} onClick={handleLogin} disabled={loading}>
              <PasskeyIcon />
              {loading ? 'Wird geladen...' : 'Mit Passkey anmelden'}
            </button>
          )}

          {/* Register with Passkey */}
          {passkeySupported && (
            <button
              style={{ ...btnPasskey, marginTop: hasRegisteredPasskeys ? '12px' : '0' }}
              onClick={() => setMode('register')}
            >
              <PasskeyIcon />
              Neuen Account erstellen
            </button>
          )}

          {/* Fallback to email/password */}
          <button style={{ ...btnSecondary, marginTop: '24px' }} onClick={() => setScreen('login')}>
            {hasRegisteredPasskeys ? 'Mit Email fortfahren' : 'Mit Email anmelden'}
          </button>

          {/* Skip for now */}
          {onSkip && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#666666',
                cursor: 'pointer',
                marginTop: '24px',
                fontSize: '14px',
                width: '100%',
              }}
              onClick={onSkip}
            >
              Später einrichten (Überspringen)
            </button>
          )}
        </main>
      </div>
    );
  }

  // Mode: Register
  if (mode === 'register') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', padding: '20px' }}>
        <header
          style={{
            backgroundColor: '#0d0d0d',
            borderBottom: '1px solid #1a1a1a',
            padding: '20px',
            textAlign: 'center',
            margin: '-20px -20px 20px -20px',
          }}
        >
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#f7931a',
              cursor: 'pointer',
              fontSize: '14px',
              float: 'left',
            }}
            onClick={() => setMode('select')}
          >
            ← Zurück
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#ffffff',
            }}
          >
            Passkey erstellen
          </h1>
        </header>

        <main style={{ maxWidth: '400px', margin: '40px auto 0' }}>
          <div
            style={{
              backgroundColor: '#1a2a1a',
              border: '1px solid #2a4a2a',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
            }}
          >
            <p style={{ color: '#4ade80', fontSize: '14px' }}>
              🔐 Dein Passkey wird mit deinem Gerät verknüpft (Fingerabdruck, Face ID oder PIN).
              Kein Passwort nötig!
            </p>
          </div>

          {error && (
            <p
              style={{
                color: '#ff4444',
                backgroundColor: '#1a0000',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
              }}
            >
              {error}
            </p>
          )}

          <input
            style={inputStyle}
            placeholder="Email (für Account-Wiederherstellung)"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setError('');
            }}
          />

          <input
            style={{ ...inputStyle, marginTop: '12px' }}
            placeholder="Anzeigename (optional)"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />

          <button
            style={{ ...btnPrimary, marginTop: '20px' }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Wird erstellt...' : 'Passkey erstellen'}
          </button>

          <button
            style={{ ...btnSecondary, marginTop: '12px' }}
            onClick={handleEmailFallbackRegister}
            disabled={loading}
          >
            {loading ? 'Wird erstellt...' : '📧 Nur Email (Fallback für Test)'}
          </button>

          <p
            style={{
              color: '#666666',
              fontSize: '12px',
              marginTop: '16px',
              textAlign: 'center',
            }}
          >
            Du wirst aufgefordert, deinen Fingerabdruck oder Face ID zu verwenden.
          </p>
        </main>
      </div>
    );
  }

  return null;
}

export default PasskeyAuthScreen;
