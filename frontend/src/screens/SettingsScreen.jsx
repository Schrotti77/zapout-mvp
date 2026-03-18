import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = 'http://localhost:8000';

const cardStyle = {
  backgroundColor: '#141414',
  border: '1px solid #222222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
};

const sectionTitleStyle = {
  color: '#666666',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  marginBottom: '12px',
  fontWeight: '600',
};

const labelStyle = {
  color: '#888888',
  fontSize: '13px',
  marginBottom: '4px',
};

const valueStyle = {
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '500',
};

const statusOnlineStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#22c55e',
  fontSize: '13px',
  fontWeight: '500',
};

const statusOfflineStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#ef4444',
  fontSize: '13px',
  fontWeight: '500',
};

const statBoxStyle = {
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: '12px',
  padding: '16px',
  textAlign: 'center',
  flex: 1,
};

const dangerButtonStyle = {
  width: '100%',
  backgroundColor: '#1f1f1f',
  color: '#ef4444',
  border: '1px solid #ef4444',
  padding: '12px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  marginTop: '8px',
};

export default function SettingsScreen({ onBack }) {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [cashuInfo, setCashuInfo] = useState(null);
  const [cashuBalance, setCashuBalance] = useState(0);
  const [payments, setPayments] = useState([]);
  const [lightningStatus, setLightningStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('zapout_token');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = getToken();
    if (!token) {
      setError('Kein Token gefunden');
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Load all data in parallel
      const [userRes, cashuInfoRes, cashuBalanceRes, paymentsRes] = await Promise.all([
        fetch(`${API_URL}/user/me`, { headers }),
        fetch(`${API_URL}/cashu/info`, { headers }),
        fetch(`${API_URL}/cashu/balance`, { headers }),
        fetch(`${API_URL}/payments`, { headers }),
      ]);

      if (userRes.ok) setUser(await userRes.json());
      if (cashuInfoRes.ok) setCashuInfo(await cashuInfoRes.json());
      if (cashuBalanceRes.ok) {
        const balanceData = await cashuBalanceRes.json();
        setCashuBalance(balanceData.balance_sats || 0);
      }
      if (paymentsRes.ok) setPayments(await paymentsRes.json());

      // Check Lightning status
      try {
        const lndStatus = await fetch(`${API_URL}/lightning/status`, { headers });
        if (lndStatus.ok) {
          setLightningStatus(await lndStatus.json());
        } else {
          setLightningStatus({ connected: false });
        }
      } catch {
        setLightningStatus({ connected: false });
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = dateStr => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr.replace(' ', 'T'));
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const completedPayments = payments.filter(p => p.status === 'completed').length;

  const changeLanguage = lng => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  if (loading) {
    return <div style={{ color: '#888888', textAlign: 'center', padding: '40px' }}>Lade...</div>;
  }

  if (error) {
    return <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>{error}</div>;
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Language Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>{t('settings.language')}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => changeLanguage('de')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: i18n.language === 'de' ? '2px solid #f7931a' : '1px solid #333',
              backgroundColor: i18n.language === 'de' ? '#1a1a1a' : '#0a0a0a',
              color: i18n.language === 'de' ? '#f7931a' : '#666',
              fontSize: '14px',
              fontWeight: i18n.language === 'de' ? '600' : '400',
              cursor: 'pointer',
            }}
          >
            🇩🇪 {t('settings.german')}
          </button>
          <button
            onClick={() => changeLanguage('en')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: i18n.language === 'en' ? '2px solid #f7931a' : '1px solid #333',
              backgroundColor: i18n.language === 'en' ? '#1a1a1a' : '#0a0a0a',
              color: i18n.language === 'en' ? '#f7931a' : '#666',
              fontSize: '14px',
              fontWeight: i18n.language === 'en' ? '600' : '400',
              cursor: 'pointer',
            }}
          >
            🇬🇧 {t('settings.english')}
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>{t('settings.account')}</div>

        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>{t('auth.email')}</div>
          <div style={valueStyle}>{user?.email || 'N/A'}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>IBAN</div>
          <div style={valueStyle}>{user?.iban || 'Nicht hinterlegt'}</div>
        </div>

        <div>
          <div style={labelStyle}>{t('settings.memberSince')}</div>
          <div style={valueStyle}>{formatDate(user?.created_at)}</div>
        </div>
      </div>

      {/* Lightning Node Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>⚡ {t('settings.lightning')}</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={labelStyle}>Status</div>
            <div style={lightningStatus?.connected ? statusOnlineStyle : statusOfflineStyle}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: lightningStatus?.connected ? '#22c55e' : '#ef4444',
                }}
              ></span>
              {lightningStatus?.connected ? t('settings.connected') : t('settings.disconnected')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={labelStyle}>Node</div>
            <div style={{ color: '#f7931a', fontSize: '13px' }}>SynapseLN</div>
          </div>
        </div>

        {lightningStatus?.alias && (
          <div style={{ marginTop: '12px' }}>
            <div style={labelStyle}>Alias</div>
            <div style={{ color: '#ffffff', fontSize: '14px' }}>{lightningStatus.alias}</div>
          </div>
        )}
      </div>

      {/* Cashu Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>🪙 {t('settings.cashuWallet')}</div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={statBoxStyle}>
            <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>
              {t('cashu.balance')}
            </div>
            <div style={{ color: '#f7931a', fontSize: '20px', fontWeight: '700' }}>
              {cashuBalance.toLocaleString()}
            </div>
            <div style={{ color: '#666666', fontSize: '11px' }}>sats</div>
          </div>
          <div style={statBoxStyle}>
            <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>Mints</div>
            <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
              {cashuInfo?.keysets?.keysets?.length || 0}
            </div>
            <div style={{ color: '#666666', fontSize: '11px' }}>verbunden</div>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>Aktiver Mint</div>
          <div style={{ color: '#ffffff', fontSize: '13px', wordBreak: 'break-all' }}>
            {cashuInfo?.mint || 'N/A'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: cashuInfo?.working ? '#22c55e' : '#ef4444',
            }}
          ></span>
          <span style={{ color: '#888888', fontSize: '13px' }}>
            Mint {cashuInfo?.working ? 'aktiv' : 'nicht erreichbar'}
          </span>
        </div>
      </div>

      {/* Payment Stats Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>📊 {t('settings.payments')}</div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={statBoxStyle}>
            <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>
              {t('settings.totalPayments')}
            </div>
            <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
              {payments.length}
            </div>
          </div>
          <div style={statBoxStyle}>
            <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>
              {t('settings.pendingPayments')}
            </div>
            <div style={{ color: '#eab308', fontSize: '20px', fontWeight: '700' }}>
              {pendingPayments}
            </div>
          </div>
          <div style={statBoxStyle}>
            <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>
              {t('settings.completedPayments')}
            </div>
            <div style={{ color: '#22c55e', fontSize: '20px', fontWeight: '700' }}>
              {completedPayments}
            </div>
          </div>
        </div>
      </div>

      {/* App Info Section */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>ℹ️ {t('settings.about')}</div>

        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>{t('settings.version')}</div>
          <div style={valueStyle}>1.0.0-beta</div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>{t('settings.backendUrl')}</div>
          <div style={valueStyle}>{API_URL}</div>
        </div>

        <div>
          <div style={labelStyle}>{t('settings.userId')}</div>
          <div style={{ color: '#666666', fontSize: '13px', fontFamily: 'monospace' }}>
            #{user?.id || 'N/A'}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{ ...cardStyle, borderColor: '#ef444433' }}>
        <div style={sectionTitleStyle}>🔒 {t('settings.security')}</div>

        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>Passwort</div>
          <div style={{ color: '#888888', fontSize: '13px' }}>••••••••</div>
        </div>

        <button style={dangerButtonStyle} onClick={() => alert('Coming soon: Passwort ändern')}>
          {t('settings.changePassword')}
        </button>

        <button
          style={{
            ...dangerButtonStyle,
            color: '#ef4444',
            borderColor: '#ef4444',
            marginTop: '12px',
          }}
          onClick={() => alert('Kontaktiere den Support um dein Konto zu löschen')}
        >
          {t('settings.deleteAccount')}
        </button>
      </div>

      {/* Logout */}
      <button
        style={{
          width: '100%',
          backgroundColor: '#1f1f1f',
          color: '#ffffff',
          border: '1px solid #333333',
          padding: '14px',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: '500',
          cursor: 'pointer',
          marginTop: '8px',
          marginBottom: '40px',
        }}
        onClick={() => {
          localStorage.removeItem('zapout_token');
          window.location.reload();
        }}
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}
