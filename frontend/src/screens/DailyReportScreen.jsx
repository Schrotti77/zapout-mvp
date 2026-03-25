/**
 * DailyReportScreen - Daily sales report and analytics
 *
 * Features:
 * - Today's summary (total sales, count, avg)
 * - Payment method breakdown
 * - Hourly sales chart
 * - Date picker for historical data
 * - Weekly overview
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorAlert } from '../components/ui/ErrorBanner';
import { getErrorMessage } from '../lib/api.js';

const formatPrice = cents => (cents / 100).toFixed(2) + ' €';
const formatSats = sats => sats?.toLocaleString('de-DE') || '0';

const cardStyle = {
  backgroundColor: '#1C1B1B',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '12px',
};

const statCardStyle = {
  backgroundColor: '#2A2A2A',
  borderRadius: '16px',
  padding: '20px',
  textAlign: 'center',
};

export default function DailyReportScreen({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

  useEffect(() => {
    loadReport();
  }, [date]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDailyReport(date);
      setReport(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  // Generate hourly chart bars
  const renderHourlyChart = () => {
    if (!report?.hourly) return null;

    const hours = [];
    for (let h = 6; h <= 23; h++) {
      const hourKey = `${h.toString().padStart(2, '0')}:00`;
      const data = report.hourly[hourKey] || { count: 0, total_cents: 0 };
      hours.push({
        hour: hourKey,
        ...data,
      });
    }

    const maxAmount = Math.max(...hours.map(h => h.total_cents), 1);

    return (
      <div style={cardStyle}>
        <h3 className="text-sm font-medium text-gray-400 mb-4">Stündliche Verkäufe</h3>
        <div className="flex items-end gap-1 h-32">
          {hours.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(
                    (h.total_cents / maxAmount) * 100,
                    h.total_cents > 0 ? 4 : 0
                  )}%`,
                  minHeight: h.total_cents > 0 ? '4px' : '0',
                }}
              />
              <span className="text-[10px] text-gray-500">{h.hour.split(':')[0]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ minHeight: '100vh', backgroundColor: '#131313', color: '#e5e2e1', padding: '16px' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          <span style={{ fontSize: '18px', fontWeight: '600' }}>Tagesbericht</span>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#2A2A2A',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Error */}
      {error && <ErrorAlert error={error} message={getErrorMessage(error)} onRetry={loadReport} />}

      {/* Loading */}
      {loading && (
        <div>
          <Skeleton variant="card" height="120px" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <Skeleton variant="card" height="100px" />
            <Skeleton variant="card" height="100px" />
          </div>
        </div>
      )}

      {/* Report Content */}
      {!loading && report && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ ...statCardStyle, backgroundColor: '#1a1a2e' }}>
              <div className="text-2xl font-bold text-primary mb-1">
                {formatPrice(report.total_sales_cents)}
              </div>
              <div className="text-xs text-gray-400">Umsatz heute</div>
            </div>
            <div style={{ ...statCardStyle }}>
              <div className="text-2xl font-bold text-white mb-1">{report.transaction_count}</div>
              <div className="text-xs text-gray-400">Transaktionen</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={statCardStyle}>
              <div className="text-lg font-bold text-white mb-1">
                {formatPrice(report.avg_transaction_cents)}
              </div>
              <div className="text-xs text-gray-400">Ø Warenkorb</div>
            </div>
            <div style={statCardStyle}>
              <div className="text-lg font-bold text-green-400 mb-1">
                +{formatPrice(report.total_tips_cents)}
              </div>
              <div className="text-xs text-gray-400">Trinkgeld</div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div style={cardStyle}>
            <h3 className="text-sm font-medium text-gray-400 mb-4">Zahlungsarten</h3>
            <div className="space-y-3">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="text-lg">⚡</span>
                  <span className="text-sm text-white">Lightning</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-sm font-medium text-white">
                    {report.lightning?.count || 0} Transaktionen
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatPrice(report.lightning?.total_cents || 0)}
                  </div>
                </div>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="text-lg">💰</span>
                  <span className="text-sm text-white">Cashu</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-sm font-medium text-white">
                    {report.cashu?.count || 0} Transaktionen
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatPrice(report.cashu?.total_cents || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Chart */}
          {renderHourlyChart()}

          {/* Quick Stats */}
          {report.transaction_count > 0 && (
            <div style={cardStyle}>
              <h3 className="text-sm font-medium text-gray-400 mb-4">Quick Stats</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '12px', backgroundColor: '#2A2A2A', borderRadius: '8px' }}>
                  <div className="text-lg font-bold text-white">
                    {report.transaction_count > 0
                      ? Math.round(
                          report.transaction_count /
                            Math.max(Object.keys(report.hourly || {}).length, 1)
                        )
                      : 0}
                  </div>
                  <div className="text-xs text-gray-400">Ø pro Stunde</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#2A2A2A', borderRadius: '8px' }}>
                  <div className="text-lg font-bold text-white">
                    {report.transaction_count > 0
                      ? (((report.lightning?.count || 0) / report.transaction_count) * 100).toFixed(
                          0
                        )
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-gray-400">Lightning Rate</div>
                </div>
              </div>
            </div>
          )}

          {/* No Data Message */}
          {report.transaction_count === 0 && (
            <div
              style={{
                ...cardStyle,
                textAlign: 'center',
                padding: '40px',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <p className="text-gray-400">Keine Verkäufe an diesem Tag</p>
              <p className="text-gray-500 text-sm mt-2">
                Wähle ein anderes Datum oder warte auf erste Sales
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
