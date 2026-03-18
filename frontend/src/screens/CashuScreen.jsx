import React, { useState, useEffect } from 'react';
import Layout from '../components/ui/Layout';
import { proofStorage, txHistory } from '../services/cashu';

const API_URL = 'http://localhost:8000';

const quickAmountStyle = {
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #2a2a2a',
  padding: '12px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
};

function CashuScreen({ token, cashuBal, setCashuBal, selectedMint, setSelectedMint, onBack }) {
  const [customCashuAmount, setCustomCashuAmount] = useState('');
  const [cashuQuote, setCashuQuote] = useState(null);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const mints = [
    { name: 'Testnut', url: 'https://testnut.cashu.space', fees: '0.5%' },
    { name: '8333.space', url: 'https://8333.space', fees: '0%' },
    { name: 'Cashu.me', url: 'https://cashu.me', fees: '1%' },
  ];

  // Cashu: Create mint quote
  const createCashuQuote = async sats => {
    try {
      const res = await fetch(
        API_URL +
          '/cashu/mint-quote?amount_cents=' +
          parseInt(sats) * 10 +
          '&mint_url=' +
          encodeURIComponent(selectedMint),
        { method: 'POST', headers: { Authorization: 'Bearer ' + token } }
      );
      const result = await res.json();
      console.log('Cashu response:', result);
      setCashuQuote(result);
    } catch (e) {
      console.error(e);
      alert('Error: ' + e.message);
    }
  };

  // Cashu: Verify token (NUT-07)
  const verifyToken = async () => {
    if (!tokenInput.trim()) return;
    try {
      setVerifyResult({ status: 'loading' });
      const res = await fetch(API_URL + '/cashu/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const result = await res.json();
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ error: e.message });
    }
  };

  // Cashu: Receive tokens
  const receiveToken = async () => {
    if (!tokenInput.trim()) return;
    try {
      const res = await fetch(API_URL + '/cashu/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        // Save proofs to localStorage
        if (result.proofs) {
          proofStorage.save(result.proofs);
        }
        // Update balance from localStorage
        const newBalance = proofStorage.getBalance();
        setCashuBal(newBalance);
        // Add to transaction history
        txHistory.add('receive', result.amount || 0, {
          token: tokenInput.trim().substring(0, 50) + '...',
        });
        // Clear input and show success
        setTokenInput('');
        setGeneratedToken('Token erfolgreich eingelöst! Balance aktualisiert.');
        setTimeout(() => setGeneratedToken(null), 3000);
      } else {
        setVerifyResult({ error: result.error || 'Einlösen fehlgeschlagen' });
      }
    } catch (e) {
      setVerifyResult({ error: e.message });
    }
  };

  return (
    <Layout title="🪙 Cashu" screen="cashu" setScreen={() => {}} onBack={onBack}>
      {/* Balance */}
      <div
        style={{
          backgroundColor: '#141414',
          border: '1px solid #222222',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <p
          style={{
            color: '#666666',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Balance
        </p>
        <p style={{ color: '#f7931a', fontSize: '36px', fontWeight: 'bold', marginTop: '4px' }}>
          {cashuBal} sats
        </p>
      </div>

      {/* Multi-Mint Selector */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ color: '#666666', fontSize: '12px', marginBottom: '8px' }}>MINT AUSWÄHLEN</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {mints.map(mint => (
            <button
              key={mint.url}
              onClick={() => setSelectedMint(mint.url)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: selectedMint === mint.url ? '2px solid #f7931a' : '1px solid #333',
                backgroundColor: selectedMint === mint.url ? '#1a1a1a' : '#0a0a0a',
                color: selectedMint === mint.url ? '#f7931a' : '#666',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {mint.name} ({mint.fees})
            </button>
          ))}
        </div>
      </div>

      {/* Mint Cashu */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
        Cashu generieren
      </h3>
      <p style={{ color: '#666666', fontSize: '14px', marginBottom: '16px' }}>
        Zahle mit Lightning und erhalte Cashu Tokens
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {[100, 500, 1000].map(amt => (
          <button key={amt} style={quickAmountStyle} onClick={() => createCashuQuote(amt)}>
            {amt} ⚡
          </button>
        ))}
      </div>

      {/* Custom Amount Input */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="number"
          placeholder="Beliebiger Betrag..."
          value={customCashuAmount}
          onChange={e => setCustomCashuAmount(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '12px',
            color: '#fff',
            fontSize: '14px',
          }}
        />
        <button
          onClick={() => customCashuAmount && createCashuQuote(parseInt(customCashuAmount))}
          disabled={!customCashuAmount}
          style={{
            ...quickAmountStyle,
            backgroundColor: '#f7931a',
            color: '#000',
            opacity: customCashuAmount ? 1 : 0.5,
          }}
        >
          Generieren
        </button>
      </div>

      {cashuQuote && (
        <div
          style={{
            backgroundColor: '#141414',
            border: '1px solid #222222',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: '#666666', fontSize: '12px' }}>
            Lightning Invoice ({cashuQuote.amount || cashuQuote.requestedAmount} sats)
          </p>
          <p
            style={{
              backgroundColor: '#0a0a0a',
              padding: '12px',
              borderRadius: '8px',
              wordBreak: 'break-all',
              fontSize: '10px',
              fontFamily: 'monospace',
              marginTop: '8px',
              color: '#22c55e',
            }}
          >
            {cashuQuote.error || cashuQuote.payment_request || cashuQuote.request || 'Lädt...'}
          </p>
          {cashuQuote.payment_request && (
            <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '12px' }}>
              ✓ Invoice bereit - bezahle um Cashu zu erhalten
            </p>
          )}
          {cashuQuote.error && (
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '12px' }}>
              Fehler: {cashuQuote.error}
            </p>
          )}
        </div>
      )}

      {/* Generated Token Display */}
      {generatedToken && (
        <div
          style={{
            backgroundColor: '#141414',
            border: '1px solid #22c55e',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            ✓ {generatedToken}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setGeneratedToken(null)}
              style={{ ...quickAmountStyle, flex: 1, backgroundColor: '#333', color: '#fff' }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Token Input & Verify/Receive */}
      <div
        style={{
          backgroundColor: '#141414',
          border: '1px solid #222222',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <p style={{ color: '#666666', fontSize: '12px', marginBottom: '8px' }}>
          TOKEN EINLÖSEN / PRÜFEN
        </p>
        <textarea
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          placeholder="Cashu Token hier einfügen..."
          style={{
            width: '100%',
            backgroundColor: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '12px',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'monospace',
            minHeight: '80px',
            marginBottom: '12px',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={verifyToken}
            style={{
              ...quickAmountStyle,
              flex: 1,
              backgroundColor: '#1a1a1a',
              border: '1px solid #f7931a',
              color: '#f7931a',
            }}
          >
            ✓ Prüfen (NUT-07)
          </button>
          <button
            onClick={receiveToken}
            style={{ ...quickAmountStyle, flex: 1, backgroundColor: '#f7931a', color: '#000' }}
          >
            Einlösen
          </button>
        </div>

        {/* Verify Result */}
        {verifyResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
            }}
          >
            {verifyResult.status === 'loading' && <p style={{ color: '#666' }}>Prüfe Token...</p>}
            {verifyResult.valid !== undefined && (
              <p style={{ color: verifyResult.valid ? '#22c55e' : '#ef4444', fontSize: '14px' }}>
                {verifyResult.valid
                  ? '✓ Token ist gültig'
                  : '✗ Token ist ungültig oder bereits eingelöst'}
              </p>
            )}
            {verifyResult.error && (
              <p style={{ color: '#ef4444', fontSize: '12px' }}>Fehler: {verifyResult.error}</p>
            )}
            {verifyResult.amount && (
              <p style={{ color: '#f7931a', fontSize: '14px' }}>
                Betrag: {verifyResult.amount} sats
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          backgroundColor: '#141414',
          border: '1px solid #222222',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <p style={{ color: '#666666', fontSize: '12px' }}>Was ist Cashu?</p>
        <p style={{ color: '#999999', fontSize: '14px', marginTop: '8px' }}>
          Digitale Bargeld-Tokens für Bitcoin Lightning. Privates, dezentrales digitales Bargeld.
        </p>
      </div>
    </Layout>
  );
}

export default CashuScreen;
