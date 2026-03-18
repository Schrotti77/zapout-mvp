import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/ui/Layout';
import { proofStorage, txHistory } from '../services/cashu';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

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

function CashuScreen({
  token,
  cashuBal,
  setCashuBal,
  selectedMint,
  setSelectedMint,
  setScreen,
  onBack,
}) {
  const [customCashuAmount, setCustomCashuAmount] = useState('');
  const [cashuQuote, setCashuQuote] = useState(null);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [showInvoiceQR, setShowInvoiceQR] = useState(false);
  const [showTokenQR, setShowTokenQR] = useState(false);
  const [scanningQR, setScanningQR] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const mints = [
    { name: 'Testnut', url: 'https://testnut.cashu.space', fees: '0.5%' },
    { name: '8333.space', url: 'https://8333.space', fees: '0%' },
    { name: 'Cashu.me', url: 'https://cashu.me', fees: '1%' },
  ];

  // Cashu: Create mint quote
  const createCashuQuote = async sats => {
    try {
      setShowInvoiceQR(false);
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

  // QR Scanner functions
  const startScanner = async () => {
    setScanningQR(true);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        decodedText => {
          // Got QR code result
          setTokenInput(decodedText);
          stopScanner();
          setVerifyResult(null);
        },
        () => {
          // QR code not detected yet - ignore
        }
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      alert('Kamera-Zugriff verweigert oder nicht verfügbar');
      setScanningQR(false);
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err));
      html5QrCodeRef.current = null;
    }
    setScanningQR(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Get the invoice string from quote
  const getInvoiceString = () => {
    if (!cashuQuote) return '';
    return cashuQuote.payment_request || cashuQuote.request || '';
  };

  // Get sats amount from quote
  const getQuoteSats = () => {
    if (!cashuQuote) return 0;
    return cashuQuote.amount || cashuQuote.requestedAmount || 0;
  };

  return (
    <Layout title="🪙 Cashu" screen="cashu" setScreen={setScreen} onBack={onBack}>
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
            Lightning Invoice ({getQuoteSats()} sats)
          </p>

          {/* QR Code Display */}
          {getInvoiceString() && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {!showInvoiceQR ? (
                <button
                  onClick={() => setShowInvoiceQR(true)}
                  style={{
                    ...quickAmountStyle,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #22c55e',
                    color: '#22c55e',
                  }}
                >
                  📷 QR-Code anzeigen
                </button>
              ) : (
                <div>
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'inline-block',
                      marginBottom: '12px',
                    }}
                  >
                    <QRCodeSVG value={getInvoiceString()} size={200} level={'M'} />
                  </div>
                  <button
                    onClick={() => setShowInvoiceQR(false)}
                    style={{
                      ...quickAmountStyle,
                      backgroundColor: '#333',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  >
                    Schließen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Invoice string */}
          <p
            style={{
              backgroundColor: '#0a0a0a',
              padding: '12px',
              borderRadius: '8px',
              wordBreak: 'break-all',
              fontSize: '10px',
              fontFamily: 'monospace',
              marginTop: '12px',
              color: '#22c55e',
            }}
          >
            {cashuQuote.error || getInvoiceString() || 'Lädt...'}
          </p>
          {getInvoiceString() && (
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

      {/* Generated Token Display with QR */}
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

        {/* QR Scanner */}
        {scanningQR ? (
          <div style={{ marginBottom: '16px' }}>
            <div id="qr-reader" style={{ width: '100%' }} />
            <button
              onClick={stopScanner}
              style={{
                ...quickAmountStyle,
                marginTop: '12px',
                backgroundColor: '#ef4444',
                color: '#fff',
              }}
            >
              Scanner schließen
            </button>
          </div>
        ) : (
          <button
            onClick={startScanner}
            style={{
              ...quickAmountStyle,
              marginBottom: '16px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #f7931a',
              color: '#f7931a',
              width: '100%',
            }}
          >
            📷 QR-Code scannen
          </button>
        )}

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

        {/* Token QR Display */}
        {tokenInput && !scanningQR && (
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            {!showTokenQR ? (
              <button
                onClick={() => setShowTokenQR(true)}
                style={{
                  ...quickAmountStyle,
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #f7931a',
                  color: '#f7931a',
                }}
              >
                📷 Token als QR anzeigen
              </button>
            ) : (
              <div>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '16px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    marginBottom: '12px',
                  }}
                >
                  <QRCodeSVG value={tokenInput} size={200} level={'M'} />
                </div>
                <button
                  onClick={() => setShowTokenQR(false)}
                  style={{
                    ...quickAmountStyle,
                    backgroundColor: '#333',
                    color: '#fff',
                    fontSize: '12px',
                    display: 'block',
                    width: '100%',
                  }}
                >
                  Schließen
                </button>
              </div>
            )}
          </div>
        )}

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
