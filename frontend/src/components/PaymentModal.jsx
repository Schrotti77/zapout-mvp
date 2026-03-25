import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useWebSocket } from '../hooks/useWebSocket';

export default function PaymentModal({ isOpen, onClose, orderData, onStatusChange }) {
  const canvasRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, paid, expired
  const [liveSats, setLiveSats] = useState(null);
  const [btcPrice, setBtcPrice] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  // WebSocket URL for real-time updates (NUT-17)
  const wsUrl = orderData?.payment_id
    ? `ws://${window.location.hostname}:8000/ws/payments/${orderData.payment_id}`
    : null;

  // WebSocket connection for payment status updates
  // SEC-CRIT-02: Pass auth token for WebSocket authentication
  const authToken = localStorage.getItem('zapout_token');
  const { status: wsStatus, isConnected } = useWebSocket(wsUrl, {
    enabled: isOpen && paymentStatus === 'pending' && !!orderData?.payment_id,
    token: authToken, // SEC-CRIT-02: Required for auth
    onMessage: data => {
      console.log('[WS] Payment update:', data);

      if (data.type === 'status_update') {
        if (data.status === 'paid') {
          setPaymentStatus('paid');
          onStatusChange?.('paid');
        }
      } else if (data.type === 'timeout' || data.type === 'expired') {
        setPaymentStatus('expired');
      } else if (data.type === 'connected') {
        setWsConnected(true);
        console.log('[WS] Subscribed to payment updates');
      }
    },
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
  });

  // Generate QR Code
  useEffect(() => {
    if (isOpen && canvasRef.current && orderData?.invoice?.bolt11) {
      const paymentRequest = orderData.invoice.bolt11;

      QRCode.toCanvas(canvasRef.current, `lightning:${paymentRequest}`, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).catch(err => console.error('QR生成エラー:', err));
    }
  }, [isOpen, orderData]);

  // Live BTC price and sats conversion
  useEffect(() => {
    if (!orderData?.amount_cents) return;

    async function fetchLivePrice() {
      try {
        const priceRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'
        );
        const priceData = await priceRes.json();
        const price = priceData?.bitcoin?.eur || 45000;
        setBtcPrice(price);
        const sats = Math.round((orderData.amount_cents / 100 / price) * 100000000);
        setLiveSats(sats);
      } catch (e) {
        // Fallback to ~500 sats per EUR
        setLiveSats(Math.round((orderData.amount_cents / 100) * 500));
      }
    }
    fetchLivePrice();
  }, [orderData?.amount_cents]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setPaymentStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Reset state when modal opens with new order
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus('pending');
      setTimeLeft(600);
      setWsConnected(false);
    }
  }, [isOpen, orderData?.payment_id]);

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyInvoice = () => {
    if (orderData?.invoice?.bolt11) {
      navigator.clipboard.writeText(orderData.invoice.bolt11);
      alert('Invoice in Zwischenablage kopiert!');
    }
  };

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modal: {
      background: '#fff',
      borderRadius: '20px',
      padding: '30px',
      maxWidth: '400px',
      width: '90%',
      textAlign: 'center',
    },
    title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' },
    qrContainer: {
      background: '#fff',
      padding: '20px',
      borderRadius: '12px',
      display: 'inline-block',
      marginBottom: '20px',
    },
    amount: { fontSize: '32px', fontWeight: 'bold', color: '#f7931a', marginBottom: '10px' },
    sats: { fontSize: '16px', color: '#666', marginBottom: '20px' },
    timer: {
      fontSize: '18px',
      color: timeLeft < 60 ? '#dc3545' : '#666',
      marginBottom: '20px',
      fontWeight: timeLeft < 60 ? 'bold' : 'normal',
    },
    copyBtn: {
      background: '#f5f5f5',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      marginBottom: '15px',
      fontSize: '12px',
      width: '100%',
    },
    status: {
      padding: '15px',
      borderRadius: '12px',
      fontSize: '18px',
      fontWeight: 'bold',
      background:
        paymentStatus === 'paid' ? '#d4edda' : paymentStatus === 'expired' ? '#f8d7da' : '#fff3cd',
      color:
        paymentStatus === 'paid' ? '#155724' : paymentStatus === 'expired' ? '#721c24' : '#856404',
    },
    closeBtn: {
      background: '#f7931a',
      color: '#fff',
      border: 'none',
      padding: '14px 30px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '20px',
      width: '100%',
    },
  };

  return (
    <div
      style={styles.overlay}
      onClick={e => e.target === e.currentTarget && paymentStatus !== 'paid' && onClose()}
    >
      <div style={styles.modal}>
        {paymentStatus === 'paid' ? (
          <>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✅</div>
            <h2 style={styles.title}>Zahlung erhalten!</h2>
            <p>Vielen Dank für Ihre Bestellung.</p>
          </>
        ) : paymentStatus === 'expired' ? (
          <>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏰</div>
            <h2 style={styles.title}>Abgelaufen</h2>
            <p>Die Invoice ist abgelaufen. Bitte erneut bestellen.</p>
          </>
        ) : (
          <>
            <h2 style={styles.title}>Zahlung erforderlich</h2>
            {(() => {
              const cents = orderData?.amount_cents || 0;
              const eur = (cents / 100).toFixed(2);
              const fallbackSats = Math.round((cents / 100) * 500); // ~500 sats per EUR
              const displaySats = liveSats !== null ? liveSats : fallbackSats;
              return (
                <>
                  <div style={styles.amount}>€{eur}</div>
                  <div style={{ ...styles.sats, color: '#00d4aa' }}>
                    {liveSats === null
                      ? '🔄 Live-Umrechnung...'
                      : `⚡ ${displaySats.toLocaleString()} sats`}
                  </div>
                </>
              );
            })()}

            <div style={styles.qrContainer}>
              <canvas ref={canvasRef} />
            </div>

            <div style={styles.timer}>⏰ Gültig für {formatTime(timeLeft)}</div>

            <button style={styles.copyBtn} onClick={copyInvoice}>
              📋 Invoice kopieren
            </button>

            <div style={styles.status}>
              {wsConnected ? (
                <span>🔔 Echtzeit-Updates aktiv</span>
              ) : (
                <span>⏳ Warte auf Zahlung...</span>
              )}
            </div>
          </>
        )}

        <button style={styles.closeBtn} onClick={onClose}>
          {paymentStatus === 'paid' ? 'Zurück zum Shop' : 'Schließen'}
        </button>
      </div>
    </div>
  );
}
