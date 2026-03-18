import React, { useState, useEffect } from 'react'
import MerchantScreen from './screens/MerchantScreen'
import SwapScreen from './screens/SwapScreen'
import Products from './screens/Products'
import SettingsScreen from './screens/SettingsScreen'
import CartDrawer from './components/CartDrawer'
import PaymentModal from './components/PaymentModal'
import Layout, { ScreenCard, PageTitle, SectionTitle, Badge } from './components/ui/Layout'
import { proofStorage, txHistory } from './services/cashu'

const API_URL = 'http://localhost:8000'

function App() {
  const [screen, setScreen] = useState('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('zapout_token'))
  const [payments, setPayments] = useState([])
  const [amount, setAmount] = useState('')
  const [invoice, setInvoice] = useState(null)
  const [cashuQuote, setCashuQuote] = useState(null)
  const [cashuBal, setCashuBal] = useState(0)
  const [selectedMint, setSelectedMint] = useState('https://testnut.cashu.space')
  const [tokenInput, setTokenInput] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [cashuTokens, setCashuTokens] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  
  // Cashu improvements
  const [customCashuAmount, setCustomCashuAmount] = useState('')
  const [generatedToken, setGeneratedToken] = useState(null)

  useEffect(() => {
    if (token) {
      setScreen('dashboard')
      loadPayments()
    }
  }, [token])

  const loadPayments = async () => {
    try {
      const res = await fetch(API_URL + '/payments', { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      setPayments(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('loadPayments error:', e)
      setPayments([])
    }
  }

  const handleRegister = async () => {
    const res = await fetch(API_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.token) {
      localStorage.setItem('zapout_token', data.token)
      setToken(data.token)
    }
  }

  const handleLogin = async () => {
    const res = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.token) {
      localStorage.setItem('zapout_token', data.token)
      setToken(data.token)
    }
  }

  const createPayment = async () => {
    const cents = Math.round(parseFloat(amount) * 100)
    
    // Get current BTC price for sats conversion
    let btcPrice = 64416 // fallback
    try {
      const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur')
      const priceData = await priceRes.json()
      btcPrice = priceData?.bitcoin?.eur || 64416
    } catch (e) { console.log('Price fetch failed, using fallback') }
    
    // Calculate sats: (cents / 100) EUR = sats
    const sats = Math.round((cents / 100) / btcPrice * 100000000)
    
    const res = await fetch(API_URL + '/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount_cents: cents, amount_sats: sats, method: 'lightning' })
    })
    const data = await res.json()
    setInvoice({ ...data, amount_sats: sats, btc_price: btcPrice })
  }

  const createCashuQuote = async (sats) => {
    try {
      const res = await fetch(API_URL + "/cashu/mint-quote?amount_cents=" + (parseInt(sats) * 10) + "&mint_url=" + encodeURIComponent(selectedMint), { method: "POST", headers: { Authorization: "Bearer " + token } }); 
      const result = await res.json();
      console.log('Cashu response:', result);
      setCashuQuote(result);
    } catch(e) {
      console.error(e);
      alert("Error: " + e.message);
    }
  }

  // Cashu: Verify token (NUT-07)
  const verifyToken = async () => {
    if (!tokenInput.trim()) return
    try {
      setVerifyResult({ status: 'loading' })
      const res = await fetch(API_URL + "/cashu/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ token: tokenInput.trim() })
      })
      const result = await res.json()
      setVerifyResult(result)
    } catch(e) {
      setVerifyResult({ error: e.message })
    }
  }

  // Cashu: Receive tokens
  const receiveToken = async () => {
    if (!tokenInput.trim()) return
    try {
      const res = await fetch(API_URL + "/cashu/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ token: tokenInput.trim() })
      })
      const result = await res.json()
      if (result.success) {
        // Save proofs to localStorage
        if (result.proofs) {
          proofStorage.save(result.proofs)
        }
        // Update balance from localStorage
        const newBalance = proofStorage.getBalance()
        setCashuBal(newBalance)
        // Add to transaction history
        txHistory.add('receive', result.amount || 0, { token: tokenInput.trim().substring(0, 50) + '...' })
        // Clear input and show success
        setTokenInput('')
        setVerifyResult({ valid: true, amount: result.amount, message: `✓ ${result.amount} sats erfolgreich eingelöst!` })
        setCashuTokens([...cashuTokens, result])
      } else {
        setVerifyResult({ valid: false, error: result.error || 'Unbekannt', message: '✗ Einlösen fehlgeschlagen' })
      }
    } catch(e) {
      setVerifyResult({ valid: false, error: e.message, message: '✗ Fehler: ' + e.message })
    }
  }

  // Cashu: Load balance
  const loadCashuBalance = async () => {
    try {
      // Try backend first
      const res = await fetch(API_URL + "/cashu/balance", { headers: { Authorization: "Bearer " + token } })
      const data = await res.json()
      const backendBalance = data.balance || 0
      // Also check localStorage
      const localBalance = proofStorage.getBalance()
      // Use the higher of the two (or backend if available)
      setCashuBal(backendBalance > 0 ? backendBalance : localBalance)
    } catch(e) {
      // Fallback to localStorage
      console.log('Cashu balance error, using localStorage:', e)
      setCashuBal(proofStorage.getBalance())
    }
  }

  // Load cashu balance on mount
  useEffect(() => { if (token) loadCashuBalance() }, [token])

  const logout = () => {
    localStorage.removeItem('zapout_token')
    setToken(null)
    setScreen('register')
  }

  const today = (payments || [])
    .filter(p => p && p.created_at && new Date(p.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100

  // Common button style
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
    boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)'
  }

  const btnSecondary = {
    backgroundColor: '#1f1f1f',
    color: '#ffffff',
    border: '1px solid #333333',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%'
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '16px',
    outline: 'none'
  }

  const quickAmountStyle = {
    backgroundColor: '#1f1f1f',
    color: '#ffffff',
    border: '1px solid #2a2a2a',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }

  // Register
  if (screen === 'register') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', padding: '20px' }}>
        <header style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '20px', textAlign: 'center', margin: '-20px -20px 20px -20px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', background: 'linear-gradient(90deg, #f7931a, #ffa333)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ZapOut</h1>
          <p style={{ color: '#666666', fontSize: '14px', marginTop: '4px' }}>Bitcoin Payments</p>
        </header>
        <main style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>Registrieren</h2>
          <input style={inputStyle} placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={{ ...inputStyle, marginTop: '12px' }} type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} />
          <button style={{ ...btnPrimary, marginTop: '20px' }} onClick={handleRegister}>Konto erstellen</button>
          <p style={{ textAlign: 'center', marginTop: '16px', color: '#666666' }}>
            Oder <span style={{ color: '#f7931a', cursor: 'pointer' }} onClick={() => setScreen('login')}>Login</span>
          </p>
        </main>
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} setScreen={setScreen} />
      </div>
    )
  }

  // Login
  if (screen === 'login') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', padding: '20px' }}>
        <header style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '20px', textAlign: 'center', margin: '-20px -20px 20px -20px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', background: 'linear-gradient(90deg, #f7931a, #ffa333)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ZapOut</h1>
        </header>
        <main style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>Login</h2>
          <input style={inputStyle} placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={{ ...inputStyle, marginTop: '12px' }} type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} />
          <button style={{ ...btnPrimary, marginTop: '20px' }} onClick={handleLogin}>Login</button>
        </main>
        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} setScreen={setScreen} />
      </div>
    )
  }

  // Dashboard
  if (screen === 'dashboard') {
    return (
      <Layout title="ZapOut" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
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
                amount_sats: invoice.amount_sats || Math.round(invoice.amount_cents / invoice.btc_price * 100000000),
                currency: 'EUR',
                invoice: {
                  bolt11: invoice.bolt11,
                  payment_request: invoice.bolt11
                },
                payment_id: invoice.id
              }}
              onStatusChange={(status) => {
                if (status === 'paid') {
                  loadPayments()
                  setInvoice(null)
                }
              }}
            />
            <button style={btnPrimary} onClick={() => setInvoice(null)}>Neue Zahlung</button>
          </>
        ) : (
          <>
            <div style={{ backgroundColor: '#141414', border: '1px solid #222222', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ color: '#666666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Heute</p>
              <p style={{ color: '#ffffff', fontSize: '36px', fontWeight: 'bold', marginTop: '4px' }}>{today.toFixed(2)} €</p>
              <p style={{ color: '#666666', fontSize: '14px' }}>{(payments || []).length} Zahlungen</p>
            </div>
            
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>Schnell-Betrag</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {['10', '20', '50'].map(amt => (
                <button key={amt} style={quickAmountStyle} onClick={() => setAmount(amt)}>{amt} €</button>
              ))}
            </div>
            <input 
              style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}
              placeholder="0.00 €" 
              value={amount} 
              onChange={e => setAmount(e.target.value)}
            />
            <button style={btnPrimary} onClick={createPayment} disabled={!amount}>ZAHLUNG ANFORDERN</button>
          </>
        )}

        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginTop: '24px', marginBottom: '12px' }}>Letzte Zahlungen</h3>
        {(payments || []).slice(0,5).map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #222222' }}>
            <span style={{ color: '#666666' }}>{new Date(p.created_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span>
            <span style={{ fontWeight: '600', color: '#ffffff' }}>{(p.amount_cents/100).toFixed(2)} €</span>
            <Badge variant={p.status==='completed' ? 'success' : 'default'}>{p.status}</Badge>
          </div>
        ))}
      </Layout>
    )
  }

  // Cashu Screen
  if (screen === 'cashu') {
    const mints = [
      { name: 'Testnut', url: 'https://testnut.cashu.space', fees: '0.5%' },
      { name: '8333.space', url: 'https://8333.space', fees: '0%' },
      { name: 'Cashu.me', url: 'https://cashu.me', fees: '1%' }
    ]
    
    return (
      <Layout title="🪙 Cashu" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
        {/* Balance */}
        <div style={{ backgroundColor: '#141414', border: '1px solid #222222', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ color: '#666666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Balance</p>
          <p style={{ color: '#f7931a', fontSize: '36px', fontWeight: 'bold', marginTop: '4px' }}>{cashuBal} sats</p>
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
                  cursor: 'pointer'
                }}
              >
                {mint.name} ({mint.fees})
              </button>
            ))}
          </div>
        </div>
        
        {/* Mint Cashu */}
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>Cashu generieren</h3>
        <p style={{ color: '#666666', fontSize: '14px', marginBottom: '16px' }}>Zahle mit Lightning und erhalte Cashu Tokens</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {[100, 500, 1000].map(amt => (
            <button key={amt} style={quickAmountStyle} onClick={() => createCashuQuote(amt)}>{amt} ⚡</button>
          ))}
        </div>
        
        {/* Custom Amount Input */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="number"
            placeholder="Beliebiger Betrag..."
            value={customCashuAmount}
            onChange={(e) => setCustomCashuAmount(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '12px',
              color: '#fff',
              fontSize: '14px'
            }}
          />
          <button
            onClick={() => customCashuAmount && createCashuQuote(parseInt(customCashuAmount))}
            disabled={!customCashuAmount}
            style={{
              ...quickAmountStyle,
              backgroundColor: '#f7931a',
              color: '#000',
              opacity: customCashuAmount ? 1 : 0.5
            }}
          >
            Generieren
          </button>
        </div>
        
        {cashuQuote && (
          <div style={{ backgroundColor: '#141414', border: '1px solid #222222', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ color: '#666666', fontSize: '12px' }}>Lightning Invoice ({cashuQuote.amount || cashuQuote.requestedAmount} sats)</p>
            <p style={{ backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '8px', wordBreak: 'break-all', fontSize: '10px', fontFamily: 'monospace', marginTop: '8px', color: '#22c55e' }}>
              {cashuQuote.error || cashuQuote.payment_request || cashuQuote.request || 'Lädt...'}
            </p>
            {cashuQuote.payment_request && (
              <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '12px' }}>✓ Invoice bereit - bezahle um Cashu zu erhalten</p>
            )}
            {cashuQuote.error && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '12px' }}>Fehler: {cashuQuote.error}</p>
            )}
          </div>
        )}
        
        {/* Generated Token Display */}
        {generatedToken && (
          <div style={{ backgroundColor: '#141414', border: '1px solid #22c55e', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>✓ Cashu Token generiert!</p>
            <textarea
              readOnly
              value={generatedToken}
              style={{
                width: '100%',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '12px',
                color: '#22c55e',
                fontSize: '10px',
                fontFamily: 'monospace',
                minHeight: '60px',
                marginBottom: '12px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigator.clipboard.writeText(generatedToken)}
                style={{ ...quickAmountStyle, flex: 1, backgroundColor: '#1a1a1a', border: '1px solid #22c55e', color: '#22c55e' }}
              >
                📋 Kopieren
              </button>
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
        <div style={{ backgroundColor: '#141414', border: '1px solid #222222', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ color: '#666666', fontSize: '12px', marginBottom: '8px' }}>TOKEN EINLÖSEN / PRÜFEN</p>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
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
              marginBottom: '12px'
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={verifyToken} style={{ ...quickAmountStyle, flex: 1, backgroundColor: '#1a1a1a', border: '1px solid #f7931a', color: '#f7931a' }}>✓ Prüfen (NUT-07)</button>
            <button onClick={receiveToken} style={{ ...quickAmountStyle, flex: 1, backgroundColor: '#f7931a', color: '#000' }}>Einlösen</button>
          </div>
          
          {/* Verify Result */}
          {verifyResult && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#0a0a0a', borderRadius: '8px' }}>
              {verifyResult.status === 'loading' && <p style={{ color: '#666' }}>Prüfe Token...</p>}
              {verifyResult.valid !== undefined && (
                <p style={{ color: verifyResult.valid ? '#22c55e' : '#ef4444', fontSize: '14px' }}>
                  {verifyResult.valid ? '✓ Token ist gültig' : '✗ Token ist ungültig oder bereits eingelöst'}
                </p>
              )}
              {verifyResult.error && <p style={{ color: '#ef4444', fontSize: '12px' }}>Fehler: {verifyResult.error}</p>}
              {verifyResult.amount && <p style={{ color: '#f7931a', fontSize: '14px' }}>Betrag: {verifyResult.amount} sats</p>}
            </div>
          )}
        </div>
        
        {/* Info */}
        <div style={{ backgroundColor: '#141414', border: '1px solid #222222', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#666666', fontSize: '12px' }}>Was ist Cashu?</p>
          <p style={{ color: '#999999', fontSize: '14px', marginTop: '8px' }}>Digitale Bargeld-Tokens für Bitcoin Lightning. Privates, dezentrales digitales Bargeld.</p>
        </div>
      </Layout>
    )
  }

  // Settings
  if (screen === 'settings') {
    return (
      <Layout title="⚙️ Einstellungen" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
        <SettingsScreen />
      </Layout>
    )
  }

  // Merchant Screen
  if (screen === 'merchant') {
    return (
      <Layout title="🏪 Händler" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
        <MerchantScreen onBack={() => setScreen('settings')} />
      </Layout>
    )
  }

  // Swap Screen
  if (screen === 'swap') {
    return (
      <Layout title="⚡ Swap" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
        <SwapScreen onBack={() => setScreen('settings')} />
      </Layout>
    )
  }

  // Products Screen
  if (screen === 'products') {
    return (
      <Layout title="🛍️ Produkte" screen={screen} setScreen={setScreen} cartOpen={cartOpen} setCartOpen={setCartOpen}>
        <Products onBack={() => setScreen('dashboard')} setScreen={setScreen} />
      </Layout>
    )
  }

  return null
}

export default App
