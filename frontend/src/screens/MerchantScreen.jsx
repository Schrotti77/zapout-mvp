import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px'
};

const quickAmountStyle = {
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #2a2a2a',
  padding: '12px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer'
};

const buttonStyle = {
  width: '100%',
  backgroundColor: '#f7931a',
  color: '#000000',
  border: 'none',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '8px'
};

const buttonSecondaryStyle = {
  width: '100%',
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '14px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: '500',
  cursor: 'pointer',
  marginTop: '8px'
};

export default function MerchantScreen({ onBack, setScreen, setCartOpen }) {
  const [view, setView] = useState('dashboard'); // dashboard, create, payment, products
  const [products, setProducts] = useState([]);
  const [amount, setAmount] = useState('');
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  const getToken = () => localStorage.getItem('zapout_token');

  // Load products and orders on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Load products
    fetch(API_URL + '/products', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setProducts(Array.isArray(data) ? data : data.products || []))
      .catch(console.error);

    // Load orders
    fetch(API_URL + '/orders', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data : data.orders || []))
      .catch(console.error);
  }, [view]);

  // Quick Payment - Create payment request
  const handlePayment = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      setError('Bitte gib einen gültigen Betrag ein');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/merchant/payment-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          amount_cents: cents,
          method: 'cashu'
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setPaymentRequest(data);
      setView('payment');
      setLoading(false);
      
      // Poll for payment status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/merchant/payment-request/${data.quote_id || data.invoice_id}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          });
          const statusData = await statusRes.json();
          
          if (statusData.paid) {
            setStatus('success');
            clearInterval(pollInterval);
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 3000);

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (e) {
      setError('Fehler: ' + e.message);
      setLoading(false);
    }
  };

  const reset = () => {
    setAmount('');
    setPaymentRequest(null);
    setStatus('pending');
    setError(null);
    setView('dashboard');
  };

  // ===== VIEW: Payment (QR Code) =====
  if (view === 'payment' && paymentRequest) {
    return (
      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {status === 'success' ? '✅' : '⏳'}
          </div>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
            {status === 'success' ? 'Zahlung erhalten!' : `Zahlung: ${amount}€`}
          </p>
          <p style={{ fontSize: '14px', color: '#666666', marginTop: '8px' }}>
            {status === 'success' ? 'Cashu Token empfangen' : 'Warte auf Zahlung...'}
          </p>
        </div>

        {status !== 'success' && (
          <div style={cardStyle}>
            <p style={{ color: '#666666', fontSize: '12px', marginBottom: '8px' }}>CASHU TOKEN (NFC)</p>
            <p style={{ backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '8px', wordBreak: 'break-all', fontSize: '10px', fontFamily: 'monospace', color: '#22c55e' }}>
              {paymentRequest.token || paymentRequest.cashu_token || 'Token wird geladen...'}
            </p>
          </div>
        )}

        <button style={buttonSecondaryStyle} onClick={reset}>
          {status === 'success' ? 'Weiter verkaufen' : 'Abbrechen'}
        </button>
      </div>
    );
  }

  // ===== VIEW: Products =====
  if (view === 'products') {
    return (
      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          🛍️ Meine Produkte ({products.length})
        </h2>

        {products.length === 0 ? (
          <div style={cardStyle}>
            <p style={{ textAlign: 'center', color: '#666666' }}>Noch keine Produkte</p>
            <button style={{ ...buttonSecondaryStyle, marginTop: '16px' }} onClick={() => setView('dashboard')}>
              ← Zurück zum Dashboard
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            {products.map(product => (
              <div key={product.id} style={{ ...cardStyle, padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#ffffff' }}>{product.name}</p>
                    <p style={{ fontSize: '14px', color: '#666666' }}>{product.description || 'Keine Beschreibung'}</p>
                  </div>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#f7931a' }}>{product.price_cents / 100}€</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button style={buttonSecondaryStyle} onClick={() => setView('dashboard')}>
          ← Zurück zum Dashboard
        </button>
      </div>
    );
  }

  // ===== VIEW: Dashboard (default) =====
  return (
    <div style={{ padding: '20px', paddingBottom: '100px' }}>
      {/* Quick Payment Section */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>Schnellzahlung</h3>
      <p style={{ color: '#666666', fontSize: '14px', marginBottom: '16px' }}>Erstelle eine QR-Code Zahlung</p>
      
      <div style={cardStyle}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            padding: '16px',
            backgroundColor: '#0a0a0a',
            border: '1px solid #333333',
            borderRadius: '12px',
            color: '#ffffff',
            outline: 'none'
          }}
        />
        <p style={{ textAlign: 'center', color: '#666666', marginTop: '8px' }}>€</p>
      </div>

      {/* Quick Amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {[5, 10, 20, 50, 100, 200].map(amt => (
          <button
            key={amt}
            onClick={() => setAmount(amt.toString())}
            style={quickAmountStyle}
          >
            {amt}€
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#7f1d1d', borderRadius: '12px', marginBottom: '16px' }}>
          <p style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      <button 
        onClick={handlePayment} 
        disabled={!amount || loading}
        style={{
          ...buttonStyle,
          opacity: !amount || loading ? 0.5 : 1
        }}
      >
        {loading ? '⏳ Wird erstellt...' : '📱 QR-Code erstellen'}
      </button>

      {/* Navigation Cards */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>Verwaltung</h3>
        
        <button
          onClick={() => setView('products')}
          style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🛍️</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>Produkte verwalten</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>{products.length} Produkte • Produkte hinzufügen & bearbeiten</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => {}}
          style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>Bestellungen</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>{orders.length} Bestellungen • Verkaufshistorie ansehen</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => {}}
          style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚙️</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>Einstellungen</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>Shop-Name, Zahlungsoptionen, NFC</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
