import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MintCard from '../components/MintCard';
import AddMintModal from '../components/AddMintModal';

const API_URL = 'http://localhost:8000';

const getToken = () => localStorage.getItem('zapout_token');

const MintSettingsScreen = () => {
  const { t } = useTranslation();
  const [mints, setMints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [settings, setSettings] = useState({
    accept_unknown_mints: true,
    auto_swap_to_lightning: true,
  });

  useEffect(() => {
    fetchMints();
    fetchSettings();
  }, []);

  const fetchMints = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/cashu/mints`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setMints(data || []);
    } catch (err) {
      console.error('Error fetching mints:', err);
      setError(err.message || 'Failed to load mints');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/cashu/settings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data) {
        setSettings({
          accept_unknown_mints: data.accept_unknown_mints ?? true,
          auto_swap_to_lightning: data.auto_swap_to_lightning ?? true,
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleAddMint = async (mintUrl, mintName) => {
    const res = await fetch(`${API_URL}/cashu/mints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mint_url: mintUrl,
        mint_name: mintName || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to add mint');
    }
    const data = await res.json();
    setMints([...mints, data]);
    setShowAddModal(false);
  };

  const handleRemoveMint = async mintId => {
    if (!confirm('Remove this mint?')) return;

    try {
      await fetch(`${API_URL}/cashu/mints/${mintId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setMints(mints.filter(m => m.id !== mintId));
    } catch (err) {
      console.error('Error removing mint:', err);
      alert('Failed to remove mint');
    }
  };

  const handleSetPreferred = async mintId => {
    try {
      const res = await fetch(`${API_URL}/cashu/mints/${mintId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_preferred: true }),
      });
      if (res.ok) {
        setMints(
          mints.map(m => ({
            ...m,
            is_preferred: m.id === mintId,
          }))
        );
      }
    } catch (err) {
      console.error('Error setting preferred:', err);
      alert('Failed to set preferred mint');
    }
  };

  const handleToggleActive = async (mintId, currentState) => {
    try {
      const res = await fetch(`${API_URL}/cashu/mints/${mintId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentState }),
      });
      const data = await res.json();
      if (res.ok) {
        setMints(mints.map(m => (m.id === mintId ? { ...m, is_active: data.is_active } : m)));
      }
    } catch (err) {
      console.error('Error toggling mint:', err);
      alert('Failed to update mint');
    }
  };

  const handleRefreshBalance = async mintId => {
    try {
      const res = await fetch(`${API_URL}/cashu/mints/${mintId}/refresh-balance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMints(mints.map(m => (m.id === mintId ? { ...m, balance_sats: data.balance_sats } : m)));
      }
    } catch (err) {
      console.error('Error refreshing balance:', err);
      alert('Failed to refresh balance');
    }
  };

  const handleUpdateSettings = async (key, value) => {
    try {
      const newSettings = { ...settings, [key]: value };
      const res = await fetch(`${API_URL}/cashu/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      alert('Failed to update settings');
    }
  };

  const totalBalance = mints.reduce((sum, m) => sum + (m.balance_sats || 0), 0);
  const activeMints = mints.filter(m => m.is_active);

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🏦 {t('mint_settings.title', 'Cashu Mints')}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {t('mint_settings.subtitle', 'Manage your Cashu mint connections')}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span>+</span>
            {t('mint_settings.add_mint', 'Add Mint')}
          </button>
        </div>

        {/* Total Balance */}
        <div className="bg-zinc-900 rounded-xl p-4 mb-6 border border-zinc-800">
          <div className="text-sm text-gray-400 mb-1">
            {t('mint_settings.total_balance', 'Total Cashu Balance')}
          </div>
          <div className="text-3xl font-bold text-orange-500">
            {totalBalance.toLocaleString()} sats
          </div>
          <div className="text-sm text-gray-500 mt-1">
            ≈ {(totalBalance * 0.00004).toFixed(2)} EUR
          </div>
        </div>

        {/* Mints List */}
        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              {t('mint_settings.loading', 'Loading mints...')}
            </div>
          ) : mints.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🏦</div>
              <p className="text-gray-400 mb-4">
                {t('mint_settings.no_mints', 'No mints configured')}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-orange-500 hover:bg-orange-600 text-black font-semibold px-6 py-2 rounded-lg"
              >
                {t('mint_settings.add_first', 'Add your first mint')}
              </button>
            </div>
          ) : (
            mints.map(mint => (
              <MintCard
                key={mint.id}
                mint={mint}
                onSetPreferred={() => handleSetPreferred(mint.id)}
                onToggleActive={() => handleToggleActive(mint.id, mint.is_active)}
                onRemove={() => handleRemoveMint(mint.id)}
                onRefreshBalance={() => handleRefreshBalance(mint.id)}
              />
            ))
          )}
        </div>

        {/* Unknown Mints Setting */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">
            {t('mint_settings.accept_unknown', 'Accept Payments from Unknown Mints')}
          </h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="accept_unknown"
                checked={settings.accept_unknown_mints}
                onChange={() => handleUpdateSettings('accept_unknown_mints', true)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">
                  {t('mint_settings.accept_any', 'Accept from any mint')}
                </div>
                <div className="text-sm text-gray-400">
                  {t('mint_settings.accept_any_desc', 'Auto-swap unknown mint tokens to Lightning')}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="accept_unknown"
                checked={!settings.accept_unknown_mints}
                onChange={() => handleUpdateSettings('accept_unknown_mints', false)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">
                  {t('mint_settings.accept_configured', 'Only configured mints')}
                </div>
                <div className="text-sm text-gray-400">
                  {t(
                    'mint_settings.accept_configured_desc',
                    'Strict validation - reject unknown mints'
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Auto-Swap Setting */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_swap_to_lightning}
                onChange={e => handleUpdateSettings('auto_swap_to_lightning', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">
                  {t('mint_settings.auto_swap', 'Auto-swap to Lightning')}
                </div>
                <div className="text-sm text-gray-400">
                  {t(
                    'mint_settings.auto_swap_desc',
                    'Automatically swap received Cashu tokens to Lightning'
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Popular Mints */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">
            {t('mint_settings.popular_mints', 'Popular Mints')}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Cashu.me', url: 'https://cashu.me/mint' },
              { name: 'NUTstash', url: 'https://nutstash.com/mint' },
              { name: '8333.space', url: 'https://8333.space:3338' },
              { name: 'Testnut', url: 'https://testnut.cashu.space' },
            ].map(mint => (
              <button
                key={mint.url}
                onClick={() => {
                  setShowAddModal(true);
                  // Pre-fill in modal would be nice
                }}
                className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 text-left"
              >
                <div className="font-medium text-sm">{mint.name}</div>
                <div className="text-xs text-gray-500 truncate">{mint.url}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Mint Modal */}
      {showAddModal && (
        <AddMintModal onClose={() => setShowAddModal(false)} onAdd={handleAddMint} />
      )}
    </div>
  );
};

export default MintSettingsScreen;
