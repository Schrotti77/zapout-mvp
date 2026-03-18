import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px',
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
  marginTop: '8px',
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
  marginTop: '8px',
};

export default function SwapScreen({ onBack, setScreen, setCartOpen }) {
  const [swapType, setSwapType] = useState('lightning-to-cashu');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cashuBal, setCashuBal] = useState(0);
  const [lightningBal, setLightningBal] = useState(0);

  const getToken = () => localStorage.getItem('zapout_token');

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(API_URL + '/cashu/balance', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setCashuBal(data.balance || 0))
      .catch(console.error);

    fetch(API_URL + '/payments', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        const paid = (data.payments || []).filter(p => p.status === 'paid');
        const total = paid.reduce((sum, p) => sum + (p.amount_sats || 0), 0);
        setLightningBal(total);
      })
      .catch(console.error);
  }, []);

  const handleSwap = async () => {
    const sats = parseInt(amount);
    const token = getToken();

    if (!sats || sats <= 0) {
      setError('Bitte gültigen Betrag eingeben');
      return;
    }
    if (!token) {
      setError('Bitte zuerst einloggen');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (swapType === 'lightning-to-cashu') {
        const res = await fetch(API_URL + '/cashu/mint-quote?amount_cents=' + sats * 10, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();

        if (data.payment_request || data.request) {
          setResult({
            type: 'lightning-to-cashu',
            amount: sats,
            invoice: data.payment_request || data.request,
            quoteId: data.quote,
            status: 'pending',
            instruction: 'Bezahle die Rechnung, um Cashu zu erhalten',
          });
        } else {
          setError(data.error || 'Fehler beim Erstellen der Rechnung');
        }
      } else {
        if (sats > cashuBal) {
          setError('Nicht genug Cashu Balance');
          setLoading(false);
          return;
        }

        const res = await fetch(API_URL + '/cashu/melt?amount_sats=' + sats, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();

        if (data.payment_request) {
          setResult({
            type: 'cashu-to-lightning',
            amount: sats,
            invoice: data.payment_request,
            status: 'ready',
            instruction: 'Rechnung kann jetzt ausbezahlt werden',
          });
          const balRes = await fetch(API_URL + '/cashu/balance', {
            headers: { Authorization: 'Bearer ' + token },
          });
          const balData = await balRes.json();
          setCashuBal(balData.balance || 0);
        } else {
          setError(data.error || 'Fehler beim Verbrennen der Tokens');
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setAmount('');
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <div style={{ padding: '20px', paddingBottom: '100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {result.status === 'pending' ? '⏳' : '✅'}
          </div>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
            {result.status === 'pending' ? 'Rechnung erstellt!' : 'Bereit!'}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#f7931a', marginTop: '8px' }}>
            {result.amount} Sats
          </p>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#666666', fontSize: '14px' }}>Richtung:</span>
            <span style={{ color: '#ffffff', fontSize: '14px' }}>
              {result.type === 'lightning-to-cashu' ? '⚡ → 🪙' : '🪙 → ⚡'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#666666', fontSize: '14px' }}>Status:</span>
            <span style={{ color: '#22c55e', fontSize: '14px' }}>
              {result.status === 'pending' ? '⏳ Wartet auf Zahlung' : '✓ Bereit'}
            </span>
          </div>
          {result.invoice && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #222222' }}>
              <p style={{ color: '#666666', fontSize: '12px', marginBottom: '8px' }}>
                Lightning Rechnung:
              </p>
              <p
                style={{
                  backgroundColor: '#0a0a0a',
                  padding: '12px',
                  borderRadius: '8px',
                  wordBreak: 'break-all',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: '#22c55e',
                }}
              >
                {result.invoice}
              </p>
            </div>
          )}
          {result.instruction && (
            <p style={{ color: '#eab308', fontSize: '12px', marginTop: '12px' }}>
              💡 {result.instruction}
            </p>
          )}
        </div>

        <button style={buttonSecondaryStyle} onClick={reset}>
          Weiter tauschen
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', paddingBottom: '100px' }}>
      {/* Balance Display */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={cardStyle}>
          <p style={{ color: '#666666', fontSize: '12px' }}>⚡ Lightning</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginTop: '4px' }}>
            {lightningBal} <span style={{ fontSize: '14px', color: '#666666' }}>sats</span>
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ color: '#666666', fontSize: '12px' }}>🪙 Cashu</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f7931a', marginTop: '4px' }}>
            {cashuBal} <span style={{ fontSize: '14px', color: '#666666' }}>sats</span>
          </p>
        </div>
      </div>

      {/* Swap Type Selection */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
        Swap Typ
      </h3>
      <p style={{ color: '#666666', fontSize: '14px', marginBottom: '16px' }}>Wähle die Richtung</p>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            setSwapType('lightning-to-cashu');
            setError(null);
          }}
          style={{
            ...cardStyle,
            marginBottom: '12px',
            border: swapType === 'lightning-to-cashu' ? '2px solid #f7931a' : '1px solid #222222',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📥</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>⚡ Lightning → 🪙 Cashu</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>
                Sats einzahlen & als Cashu erhalten
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setSwapType('cashu-to-lightning');
            setError(null);
          }}
          style={{
            ...cardStyle,
            border: swapType === 'cashu-to-lightning' ? '2px solid #f7931a' : '1px solid #222222',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📤</span>
            <div>
              <div style={{ fontWeight: '600', color: '#ffffff' }}>🪙 Cashu → ⚡ Lightning</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>
                Cashu verbrennen & Lightning erhalten
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Amount Input */}
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
        Betrag
      </h3>
      <p style={{ color: '#666666', fontSize: '14px', marginBottom: '16px' }}>
        {swapType === 'cashu-to-lightning' ? `Max: ${cashuBal} sats - ` : ''}(Sats)
      </p>

      <div style={cardStyle}>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="100"
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
            outline: 'none',
          }}
        />
      </div>

      {/* Quick Amounts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        {[100, 500, 1000, 5000].map(amt => (
          <button
            key={amt}
            onClick={() => setAmount(amt.toString())}
            disabled={swapType === 'cashu-to-lightning' && amt > cashuBal}
            style={{
              ...quickAmountStyle,
              opacity: swapType === 'cashu-to-lightning' && amt > cashuBal ? 0.3 : 1,
            }}
          >
            {amt}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#7f1d1d',
            borderRadius: '12px',
            marginBottom: '16px',
          }}
        >
          <p style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={!amount || loading}
        style={{
          ...buttonStyle,
          opacity: !amount || loading ? 0.5 : 1,
        }}
      >
        {loading
          ? '⏳ Wird getauscht...'
          : swapType === 'lightning-to-cashu'
            ? '📥 Sats einzahlen'
            : '📤 Sats auszahlen'}
      </button>

      {/* Info Box */}
      <div style={{ ...cardStyle, marginTop: '20px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#666666' }}>
          💡 <strong style={{ color: '#999' }}>Lightning → Cashu:</strong> Bezahle eine Lightning
          Rechnung und erhalte Cashu Tokens
        </p>
        <p style={{ fontSize: '12px', color: '#666666', marginTop: '8px' }}>
          💡 <strong style={{ color: '#999' }}>Cashu → Lightning:</strong> Verbrenne Cashu Tokens
          und erhalte eine Lightning Auszahlung
        </p>
      </div>
    </div>
  );
}
