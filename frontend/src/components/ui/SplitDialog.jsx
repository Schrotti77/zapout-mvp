/**
 * SplitDialog - Cashu Token Split Dialog
 * Shows when a token is larger than the payment amount
 * Displays payment token and change token as QR codes
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, getErrorMessage } from '../../lib/api.js';
import { Skeleton } from './Skeleton';
import { ErrorAlert } from './ErrorBanner';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
};

const buttonStyle = {
  backgroundColor: '#f7931a',
  color: '#000000',
  border: 'none',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
};

const buttonSecondaryStyle = {
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '500',
  cursor: 'pointer',
  width: '100%',
};

export function SplitDialog({ isOpen, onClose, token, paymentAmount, mintUrl, onSuccess }) {
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState(null);
  const [splitResult, setSplitResult] = useState(null);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [copiedChange, setCopiedChange] = useState(false);

  if (!isOpen) return null;

  const handleSplit = async () => {
    setIsSplitting(true);
    setSplitError(null);

    try {
      const result = await api.splitToken(token, paymentAmount, mintUrl);
      setSplitResult(result);
    } catch (e) {
      setSplitError(e);
    } finally {
      setIsSplitting(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'payment') {
        setCopiedPayment(true);
        setTimeout(() => setCopiedPayment(false), 2000);
      } else {
        setCopiedChange(true);
        setTimeout(() => setCopiedChange(false), 2000);
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleSuccess = () => {
    if (onSuccess && splitResult) {
      onSuccess(splitResult.payment_token, splitResult.change_token);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div style={{ ...cardStyle, width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          🔀 Token aufteilen
        </h2>

        <p style={{ color: '#888888', fontSize: '14px', marginBottom: '20px' }}>
          Dein Token hat mehr Sats als nötig. Wir teilen ihn auf:
        </p>

        {/* Amount Summary */}
        <div
          style={{
            backgroundColor: '#0a0a0a',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666666' }}>Zu bezahlen:</span>
            <span style={{ color: '#f7931a', fontWeight: '600' }}>{paymentAmount} sats</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666666' }}>Token Wert:</span>
            <span style={{ color: '#ffffff' }}>{splitResult?.total_amount || '—'} sats</span>
          </div>
        </div>

        {/* Split Button */}
        {!splitResult && (
          <>
            {splitError && (
              <ErrorAlert
                error={splitError}
                message={getErrorMessage(splitError)}
                className="mb-4"
              />
            )}

            <button
              onClick={handleSplit}
              disabled={isSplitting}
              style={{ ...buttonStyle, opacity: isSplitting ? 0.7 : 1 }}
            >
              {isSplitting ? '⏳ Token wird aufgeteilt...' : '🔀 Token aufteilen'}
            </button>
          </>
        )}

        {/* Split Result */}
        {splitResult && (
          <>
            {/* Payment Token */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  color: '#888888',
                  fontSize: '12px',
                  marginBottom: '8px',
                }}
              >
                Zahlungs-Token (für Händler)
              </label>
              <div
                style={{
                  backgroundColor: '#0a0a0a',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <QRCodeSVG value={splitResult.payment_token} size={150} level="M" />
                </div>
                <div
                  style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '10px',
                    color: '#666666',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {splitResult.payment_token?.substring(0, 50)}...
                </div>
                <button
                  onClick={() => copyToClipboard(splitResult.payment_token, 'payment')}
                  style={{
                    marginTop: '8px',
                    backgroundColor: '#1f1f1f',
                    color: copiedPayment ? '#4ade80' : '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {copiedPayment ? '✅ Kopiert!' : '📋 Kopieren'}
                </button>
              </div>
            </div>

            {/* Change Token */}
            {splitResult.change_token && (
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    color: '#888888',
                    fontSize: '12px',
                    marginBottom: '8px',
                  }}
                >
                  Rückgeld (für dich)
                </label>
                <div
                  style={{
                    backgroundColor: '#0a0a0a',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <QRCodeSVG value={splitResult.change_token} size={150} level="M" />
                  </div>
                  <div
                    style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '10px',
                      color: '#666666',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                    }}
                  >
                    {splitResult.change_token?.substring(0, 50)}...
                  </div>
                  <div
                    style={{
                      color: '#4ade80',
                      fontSize: '14px',
                      fontWeight: '600',
                      marginTop: '8px',
                    }}
                  >
                    {splitResult.change_amount} sats
                  </div>
                  <button
                    onClick={() => copyToClipboard(splitResult.change_token, 'change')}
                    style={{
                      marginTop: '8px',
                      backgroundColor: '#1f1f1f',
                      color: copiedChange ? '#4ade80' : '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedChange ? '✅ Kopiert!' : '📋 Kopieren'}
                  </button>
                </div>
              </div>
            )}

            <button onClick={handleSuccess} style={buttonStyle}>
              ✅ Zahlung abschließen
            </button>
          </>
        )}

        <button onClick={onClose} style={{ ...buttonSecondaryStyle, marginTop: '12px' }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export default SplitDialog;
