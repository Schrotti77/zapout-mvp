import React, { useState, useEffect } from 'react';
import Layout, { Badge } from '../components/ui/Layout';
import PaymentModal from '../components/PaymentModal';

const API_URL = 'http://localhost:8000';

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

function DashboardScreen({ token, payments, loadPayments, setScreen }) {
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [wallet, setWallet] = useState(null);

  // Fetch wallet info on mount
  useEffect(() => {
    if (token) {
      fetch(API_URL + '/auth/passkey/wallet', {
        headers: { Authorization: 'Bearer ' + token },
      })
        .then(r => r.json())
        .then(data => setWallet(data))
        .catch(e => console.log('Wallet fetch failed:', e));
    }
  }, [token]);

  // Calculate today's total
  const today =
    (payments || [])
      .filter(
        p =>
          p && p.created_at && new Date(p.created_at).toDateString() === new Date().toDateString()
      )
      .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

  const createPayment = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) return;

    // Get current BTC price for sats conversion
    let btcPrice = 64416; // fallback
    try {
      const priceRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'
      );
      const priceData = await priceRes.json();
      btcPrice = priceData?.bitcoin?.eur || 64416;
    } catch (e) {
      console.log('Price fetch failed, using fallback');
    }

    // Calculate sats: (cents / 100) EUR = sats
    const sats = Math.round((cents / 100 / btcPrice) * 100000000);

    try {
      const res = await fetch(API_URL + '/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount_cents: cents, amount_sats: sats, method: 'lightning' }),
      });
      const data = await res.json();
      setInvoice({ ...data, amount_sats: sats, btc_price: btcPrice });
    } catch (e) {
      console.error('createPayment error:', e);
      alert('Fehler beim Erstellen der Zahlung');
    }
  };

  return (
    <Layout title="ZapOut" screen="dashboard" setScreen={setScreen}>
      {invoice ? (
        <>
          {/* Show Payment Modal when invoice exists */}
          <PaymentModal
            isOpen={true}
            onClose={() => setInvoice(null)}
            orderData={{
              orderId: invoice.id,
              amount: invoice.amount_cents / 100,
              amount_cents: invoice.amount_cents,
              amount_sats:
                invoice.amount_sats ||
                Math.round((invoice.amount_cents / invoice.btc_price) * 100000000),
              currency: 'EUR',
              invoice: {
                bolt11: invoice.bolt11,
                payment_request: invoice.bolt11,
              },
              payment_id: invoice.id,
            }}
            onStatusChange={status => {
              if (status === 'paid') {
                loadPayments();
                setInvoice(null);
              }
            }}
          />
          <button style={btnPrimary} onClick={() => setInvoice(null)}>
            Neue Zahlung
          </button>
        </>
      ) : (
        <>
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
              Heute
            </p>
            <p style={{ color: '#ffffff', fontSize: '36px', fontWeight: 'bold', marginTop: '4px' }}>
              {today.toFixed(2)} €
            </p>
            <p style={{ color: '#666666', fontSize: '14px' }}>
              {(payments || []).length} Zahlungen
            </p>
          </div>

          {/* Wallet Info Card */}
          {wallet && wallet.connected && (
            <div
              style={{
                backgroundColor: '#0d2818',
                border: '1px solid #1a5c32',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1a5c32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                ⚡
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#4ade80', fontSize: '14px', fontWeight: '600', margin: 0 }}>
                  Lightning Wallet Verbunden
                </p>
                <p style={{ color: '#666666', fontSize: '12px', margin: '2px 0 0 0' }}>
                  {wallet.alias || 'SynapseLN'} • {wallet.num_channels} Channels
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#888888', fontSize: '10px', margin: 0 }}>Block</p>
                <p style={{ color: '#666666', fontSize: '12px', margin: 0 }}>
                  {wallet.block_height}
                </p>
              </div>
            </div>
          )}

          <h3
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '12px',
            }}
          >
            Schnell-Betrag
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {['10', '20', '50'].map(amt => (
              <button key={amt} style={quickAmountStyle} onClick={() => setAmount(amt)}>
                {amt} €
              </button>
            ))}
          </div>
          <input
            style={{
              ...inputStyle,
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '16px',
            }}
            placeholder="0.00 €"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <button style={btnPrimary} onClick={createPayment} disabled={!amount}>
            ZAHLUNG ANFORDERN
          </button>
        </>
      )}

      <h3
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#ffffff',
          marginTop: '24px',
          marginBottom: '12px',
        }}
      >
        Letzte Zahlungen
      </h3>
      {(payments || []).slice(0, 5).map(p => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #222222',
          }}
        >
          <span style={{ color: '#666666' }}>
            {new Date(p.created_at).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span style={{ fontWeight: '600', color: '#ffffff' }}>
            {(p.amount_cents / 100).toFixed(2)} €
          </span>
          <Badge variant={p.status === 'completed' ? 'success' : 'default'}>{p.status}</Badge>
        </div>
      ))}
    </Layout>
  );
}

export default DashboardScreen;
