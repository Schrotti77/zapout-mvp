import React, { useState } from 'react';
import CartDrawer from '../components/CartDrawer';

const API_URL = 'http://localhost:8000';

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

function AuthScreen({ mode, setScreen, onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben');
      return;
    }

    try {
      const res = await fetch(API_URL + '/auth/' + (isRegister ? 'register' : 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.token) {
        localStorage.setItem('zapout_token', data.token);
        onAuthSuccess(data.token);
      } else {
        setError(data.error || 'Authentifizierung fehlgeschlagen');
      }
    } catch (e) {
      setError('Verbindungsfehler: ' + e.message);
    }
  };

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
          ZapOut
        </h1>
        {isRegister && (
          <p style={{ color: '#666666', fontSize: '14px', marginTop: '4px' }}>Bitcoin Payments</p>
        )}
      </header>
      <main style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>
          {isRegister ? 'Registrieren' : 'Login'}
        </h2>

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
          placeholder="E-Mail"
          type="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            setError('');
          }}
        />
        <input
          style={{ ...inputStyle, marginTop: '12px' }}
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            setError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button style={{ ...btnPrimary, marginTop: '20px' }} onClick={handleSubmit}>
          {isRegister ? 'Konto erstellen' : 'Login'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '16px', color: '#666666' }}>
          {isRegister ? (
            <>
              Oder{' '}
              <span
                style={{ color: '#f7931a', cursor: 'pointer' }}
                onClick={() => setScreen('login')}
              >
                Login
              </span>
            </>
          ) : (
            <>
              Noch kein Konto?{' '}
              <span
                style={{ color: '#f7931a', cursor: 'pointer' }}
                onClick={() => setScreen('register')}
              >
                Registrieren
              </span>
            </>
          )}
        </p>
      </main>
      <CartDrawer isOpen={false} onClose={() => {}} setScreen={setScreen} />
    </div>
  );
}

export default AuthScreen;
