import React, { useState, useEffect } from 'react';
import './i18n';
import MerchantScreen from './screens/MerchantScreen';
import SwapScreen from './screens/SwapScreen';
import Products from './screens/Products';
import SettingsScreen from './screens/SettingsScreen';
import CashuScreen from './screens/CashuScreen';
import DashboardScreen from './screens/DashboardScreen';
import POSScreen from './screens/POSScreen';
import AuthScreen from './screens/AuthScreen';
import PasskeyAuthScreen from './screens/PasskeyAuthScreen';
import MintSettingsScreen from './screens/MintSettingsScreen';
import PaymentRequestScreen from './screens/PaymentRequestScreen';
import CartDrawer from './components/CartDrawer';
import Layout, { ScreenCard, PageTitle, SectionTitle } from './components/ui/Layout';
import { useTranslation } from 'react-i18next';
import { proofStorage, txHistory } from './services/cashu';

const API_URL = 'http://localhost:8000';

function App() {
  const { t } = useTranslation();
  // Get preferred start screen from settings
  const getDefaultScreen = () => {
    const stored = localStorage.getItem('zapout_start_screen');
    return stored === 'pos' ? 'pos' : 'dashboard';
  };

  const [screen, setScreen] = useState('passkey'); // Start with passkey screen
  const [defaultScreen, setDefaultScreen] = useState(getDefaultScreen);
  const [token, setToken] = useState(localStorage.getItem('zapout_token'));
  const [payments, setPayments] = useState([]);
  const [cashuBal, setCashuBal] = useState(0);
  const [selectedMint, setSelectedMint] = useState('https://testnut.cashu.space');
  const [cashuTokens, setCashuTokens] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null); // { orderId, amountSats, bolt11 }

  // Cashu improvements

  useEffect(() => {
    if (token) {
      setScreen(localStorage.getItem('zapout_start_screen') || 'dashboard');
      loadPayments();
    }
  }, [token]);

  const loadPayments = async () => {
    try {
      const res = await fetch(API_URL + '/payments', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('loadPayments error:', e);
      setPayments([]);
    }
  };

  const loadCashuBalance = async () => {
    try {
      // Try backend first
      const res = await fetch(API_URL + '/cashu/balance', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      const backendBalance = data.balance || 0;
      // Also check localStorage
      const localBalance = proofStorage.getBalance();
      // Use the higher of the two (or backend if available)
      setCashuBal(backendBalance > 0 ? backendBalance : localBalance);
    } catch (e) {
      // Fallback to localStorage
      console.log('Cashu balance error, using localStorage:', e);
      setCashuBal(proofStorage.getBalance());
    }
  };

  // Load cashu balance on mount
  useEffect(() => {
    if (token) loadCashuBalance();
  }, [token]);

  const logout = () => {
    localStorage.removeItem('zapout_token');
    setToken(null);
    setScreen('register');
  };

  // Auth Screens (Register/Login/Passkey)
  if (screen === 'passkey') {
    return (
      <PasskeyAuthScreen
        mode="select"
        setScreen={setScreen}
        onAuthSuccess={newToken => {
          setToken(newToken);
          // Navigate to stored screen or dashboard after successful auth
          const storedScreen = localStorage.getItem('zapout_start_screen') || 'dashboard';
          setScreen(storedScreen);
        }}
        onSkip={() => setScreen('register')}
      />
    );
  }

  if (screen === 'register' || screen === 'login') {
    return (
      <AuthScreen
        mode={screen}
        setScreen={setScreen}
        onAuthSuccess={newToken => {
          setToken(newToken);
          // Navigate to stored screen or dashboard after successful auth
          const storedScreen = localStorage.getItem('zapout_start_screen') || 'dashboard';
          setScreen(storedScreen);
        }}
      />
    );
  }

  // Dashboard
  // Dashboard Screen
  if (screen === 'dashboard') {
    return (
      <DashboardScreen
        token={token}
        payments={payments}
        loadPayments={loadPayments}
        setScreen={setScreen}
      />
    );
  }

  // POS Screen
  if (screen === 'pos') {
    return (
      <POSScreen
        onBack={() => setScreen('settings')}
        onPaymentRequest={(orderId, amountSats, bolt11) => {
          setPaymentRequest({ orderId, amountSats, bolt11 });
          setScreen('payment-request');
        }}
      />
    );
  }

  // Payment Request Screen (QR Code)
  if (screen === 'payment-request') {
    return (
      <PaymentRequestScreen
        orderId={paymentRequest?.orderId}
        amountSats={paymentRequest?.amountSats}
        bolt11={paymentRequest?.bolt11}
        onBack={() => setScreen('pos')}
        onPaid={() => {
          setPaymentRequest(null);
          setScreen('dashboard');
        }}
      />
    );
  }

  // Cashu Screen
  if (screen === 'cashu') {
    return (
      <CashuScreen
        token={token}
        cashuBal={cashuBal}
        setCashuBal={setCashuBal}
        selectedMint={selectedMint}
        setSelectedMint={setSelectedMint}
        setScreen={setScreen}
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  // Settings
  if (screen === 'settings') {
    return (
      <Layout
        title={t('settings.title')}
        screen={screen}
        setScreen={setScreen}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
      >
        <SettingsScreen onNavigate={s => setScreen(s)} />
      </Layout>
    );
  }

  // Merchant Screen
  if (screen === 'merchant') {
    return (
      <Layout
        title={t('merchant.title')}
        screen={screen}
        setScreen={setScreen}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
      >
        <MerchantScreen onBack={() => setScreen('settings')} />
      </Layout>
    );
  }

  // Swap Screen
  if (screen === 'swap') {
    return (
      <Layout
        title={t('swap.title')}
        screen={screen}
        setScreen={setScreen}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
      >
        <SwapScreen onBack={() => setScreen('settings')} />
      </Layout>
    );
  }

  // Mint Settings Screen
  if (screen === 'mint-settings') {
    return (
      <Layout
        title="Cashu Mints"
        screen={screen}
        setScreen={setScreen}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
      >
        <MintSettingsScreen />
      </Layout>
    );
  }

  // Products Screen
  if (screen === 'products') {
    return (
      <Layout
        title={t('products.title')}
        screen={screen}
        setScreen={setScreen}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
      >
        <Products onBack={() => setScreen('dashboard')} setScreen={setScreen} />
      </Layout>
    );
  }

  return null;
}

export default App;
