import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const POPULAR_MINTS = [
  { name: 'Cashu.me', url: 'https://cashu.me/mint', description: 'Popular public mint' },
  { name: 'NUTstash', url: 'https://nutstash.com/mint', description: 'Easy to use' },
  { name: '8333.space', url: 'https://8333.space:3338', description: 'Community mint' },
  { name: 'Testnet', url: 'https://testnut.cashu.space', description: 'For testing' },
];

const AddMintModal = ({ onClose, onAdd }) => {
  const { t } = useTranslation();
  const [mintUrl, setMintUrl] = useState('');
  const [mintName, setMintName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!mintUrl.trim()) {
      setError('Mint URL is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onAdd(mintUrl.trim(), mintName.trim() || undefined);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleQuickAdd = (url, name) => {
    setMintUrl(url);
    setMintName(name);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">🏦 {t('mint.add.title', 'Add Cashu Mint')}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl">
              ×
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            {t('mint.add.subtitle', 'Connect a Cashu mint to receive ecash payments')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Popular Mints */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('mint.add.popular', 'Popular Mints')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_MINTS.map(mint => (
                <button
                  key={mint.url}
                  type="button"
                  onClick={() => handleQuickAdd(mint.url, mint.name)}
                  className={`text-left p-3 rounded-lg border transition ${
                    mintUrl === mint.url
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium text-sm">{mint.name}</div>
                  <div className="text-xs text-gray-500">{mint.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('mint.add.url', 'Mint URL')} *
            </label>
            <input
              type="url"
              value={mintUrl}
              onChange={e => setMintUrl(e.target.value)}
              placeholder="https://your-mint.example.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              required
            />
          </div>

          {/* Custom Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('mint.add.name', 'Display Name')} ({t('mint.add.optional', 'Optional')})
            </label>
            <input
              type="text"
              value={mintName}
              onChange={e => setMintName(e.target.value)}
              placeholder="My Personal Mint"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-lg font-medium transition"
            >
              {t('mint.add.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-black py-3 rounded-lg font-semibold transition"
            >
              {loading ? t('mint.add.adding', 'Adding...') : t('mint.add.submit', 'Add Mint')}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="p-6 pt-0 text-xs text-gray-500">
          <p>
            💡 {t('mint.add.help', 'Find mint URLs in your Cashu wallet settings or at')}{' '}
            <a href="https://cashu.me" target="_blank" rel="noopener" className="text-orange-500">
              cashu.me
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddMintModal;
