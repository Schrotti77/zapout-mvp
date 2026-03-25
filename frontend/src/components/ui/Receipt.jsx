/**
 * Receipt Component - Digital receipt for completed payments
 *
 * Features:
 * - Order summary with items
 * - VAT breakdown
 * - Payment method & status
 * - Timestamp
 * - Print-friendly layout
 * - Save as PDF option
 */

import { useState } from 'react';

const formatPrice = cents => (cents / 100).toFixed(2) + ' €';

export default function Receipt({ order, items = [], onClose, onNewSale }) {
  const [printed, setPrinted] = useState(false);

  if (!order) return null;

  const timestamp = order.created_at
    ? new Date(order.created_at).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  // Calculate VAT breakdown from items
  const vatBreakdown = {};
  items.forEach(item => {
    const rate = item.vat_rate || 19;
    const subtotal = item.price_cents * (item.quantity || 1);
    const net = Math.round(subtotal / (1 + rate / 100));
    const vat = subtotal - net;
    if (!vatBreakdown[rate]) {
      vatBreakdown[rate] = { net: 0, vat: 0, subtotal: 0 };
    }
    vatBreakdown[rate].net += net;
    vatBreakdown[rate].vat += vat;
    vatBreakdown[rate].subtotal += subtotal;
  });

  const handlePrint = () => {
    setPrinted(true);
    window.print();
  };

  const totalCents = order.total_cents || 0;
  const tipCents = order.tip_cents || 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <header className="bg-surface-container-low px-6 py-4 border-b border-outline/10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary">Beleg</h1>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-lg hover:bg-surface-container-high transition-colors"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Receipt Content */}
      <div className="p-6 max-w-md mx-auto" id="receipt-content">
        {/* Store Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚡</div>
          <h2 className="text-xl font-bold text-primary">ZapOut</h2>
          <p className="text-sm text-on-surface-variant">Bitcoin Lightning Payment</p>
        </div>

        {/* Order Info */}
        <div className="bg-surface-container-low rounded-xl p-4 mb-6 border border-outline/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider">
              Bestellung
            </span>
            <span className="text-xs font-mono text-on-surface">#{order.order_id || order.id}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider">Datum</span>
            <span className="text-xs text-on-surface">{timestamp}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider">
              Zahlungsart
            </span>
            <span className="text-xs text-primary font-medium">
              {order.method === 'lightning' ? '⚡ Lightning' : '💰 Cashu'}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="mb-6">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider mb-3">
            Positionen
          </h3>
          <div className="space-y-2">
            {items.length > 0 ? (
              items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start py-2 border-b border-outline/5"
                >
                  <div className="flex-1">
                    <div className="text-sm text-on-surface">
                      {item.quantity || 1}× {item.product_name || item.name}
                    </div>
                    {item.vat_rate && (
                      <div className="text-xs text-on-surface-variant">
                        inkl. {item.vat_rate}% MwSt
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-on-surface font-medium ml-4">
                    {formatPrice((item.price_cents || 0) * (item.quantity || 1))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-on-surface-variant italic">Keine Positionen</div>
            )}
          </div>
        </div>

        {/* VAT Breakdown */}
        {Object.keys(vatBreakdown).length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider mb-3">
              MwSt-Aufschlüsselung
            </h3>
            <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
              {Object.entries(vatBreakdown).map(([rate, data]) => (
                <div key={rate} className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Netto ({rate}% MwSt)</span>
                  <span className="text-on-surface">{formatPrice(data.net)}</span>
                </div>
              ))}
              {Object.entries(vatBreakdown).map(([rate, data]) => (
                <div key={`vat-${rate}`} className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">MwSt</span>
                  <span className="text-on-surface">{formatPrice(data.vat)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="bg-surface-container-high rounded-xl p-4 mb-6 border border-primary/20">
          {tipCents > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-on-surface">Zwischensumme</span>
              <span className="text-sm text-on-surface">{formatPrice(totalCents - tipCents)}</span>
            </div>
          )}
          {tipCents > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-primary">💰 Trinkgeld</span>
              <span className="text-sm text-primary">+{formatPrice(tipCents)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-outline/20">
            <span className="text-lg font-bold text-on-surface">Gesamt</span>
            <span className="text-lg font-bold text-primary">{formatPrice(totalCents)}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-on-surface-variant">in Bitcoin</span>
            <span className="text-xs text-on-surface-variant">
              ₿ {(((totalCents / 100) * 100000000) / (order.btc_price || 70000)).toFixed(0)} sats
            </span>
          </div>
        </div>

        {/* Payment Status */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20">
            <span className="text-lg">✓</span>
            <span className="text-sm font-medium">Bezahlt</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-on-surface-variant">
          <p>Vielen Dank für Ihren Einkauf!</p>
          <p className="mt-1">Powered by ZapOut ⚡</p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 max-w-md mx-auto space-y-3">
        <button
          onClick={handlePrint}
          className="w-full py-4 px-6 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98]"
        >
          🖨️ Beleg drucken
        </button>
        <button
          onClick={onNewSale}
          className="w-full py-4 px-6 bg-surface-container-high text-on-surface font-medium rounded-xl border border-outline/10 hover:bg-surface-container-highest transition-colors"
        >
          ➕ Neue Sale
        </button>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content, #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white;
            color: black;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
