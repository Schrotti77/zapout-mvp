import React from 'react';
import { useTranslation } from 'react-i18next';

const MintCard = ({ mint, onSetPreferred, onToggleActive, onRemove, onRefreshBalance }) => {
  const { t } = useTranslation();

  return (
    <div
      className={`bg-zinc-900 rounded-xl p-4 border ${
        mint.is_preferred ? 'border-orange-500' : 'border-zinc-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              mint.is_preferred ? 'bg-orange-500' : 'bg-zinc-800'
            }`}
          >
            🏦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {mint.mint_name || mint.mint_url.split('//')[1]?.split('/')[0]}
              </span>
              {mint.is_preferred && (
                <span className="text-xs bg-orange-500 text-black px-2 py-0.5 rounded-full font-medium">
                  {t('mint.preferred', 'Preferred')}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate max-w-[200px]">{mint.mint_url}</div>
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className={`w-3 h-3 rounded-full ${mint.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
          title={mint.is_active ? 'Active' : 'Inactive'}
        />
      </div>

      {/* Balance */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-orange-500">
          {(mint.balance_sats || 0).toLocaleString()} sats
        </div>
        <div className="text-sm text-gray-500">
          ≈ {((mint.balance_sats || 0) * 0.00004).toFixed(4)} EUR
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!mint.is_preferred && (
          <button
            onClick={onSetPreferred}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-orange-500 px-3 py-1.5 rounded-lg transition"
          >
            ⭐ {t('mint.set_preferred', 'Set Preferred')}
          </button>
        )}

        <button
          onClick={onToggleActive}
          className={`text-xs px-3 py-1.5 rounded-lg transition ${
            mint.is_active
              ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-500'
              : 'bg-green-900 hover:bg-green-800 text-green-400'
          }`}
        >
          {mint.is_active ? '⏸ Disable' : '✅ Enable'}
        </button>

        <button
          onClick={onRefreshBalance}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-gray-400 px-3 py-1.5 rounded-lg transition"
        >
          🔄 Refresh
        </button>

        <button
          onClick={onRemove}
          className="text-xs bg-zinc-800 hover:bg-red-900 text-red-500 px-3 py-1.5 rounded-lg transition ml-auto"
        >
          🗑️ Remove
        </button>
      </div>

      {/* Last Checked */}
      {mint.last_checked && (
        <div className="text-xs text-gray-600 mt-2">
          {t('mint.last_checked', 'Last checked')}: {new Date(mint.last_checked).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default MintCard;
