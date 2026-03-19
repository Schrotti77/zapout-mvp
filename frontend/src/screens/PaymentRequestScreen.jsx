import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = 'http://localhost:8000';

// Design System Tokens
const surface = '#131313';
const surfaceContainerLow = '#1C1B1B';
const surfaceContainerHigh = '#2A2A2A';
const surfaceContainerHighest = '#353534';
const surfaceBright = '#393939';
const surfaceContainerLowest = '#0e0e0e';
const primary = '#ffb874';
const primaryContainer = '#f7931a';
const onPrimaryContainer = '#603500';
const onSurface = '#e5e2e1';
const onSurfaceVariant = '#dbc2ae';
const tertiary = '#86cfff';
const tertiaryContainer = '#00b6fe';
const outlineVariant = '#554335';

export default function PaymentRequestScreen({ orderId, amountSats, bolt11, onBack, onPaid }) {
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, confirmed, failed
  const [statusMessage, setStatusMessage] = useState('Warte auf Zahlung...');
  const [copied, setCopied] = useState(false);

  const handleCopyInvoice = async () => {
    if (bolt11) {
      await navigator.clipboard.writeText(bolt11);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (bolt11 && navigator.share) {
      try {
        await navigator.share({
          title: 'ZapOut Payment',
          text: `Pay ${amountSats} sats via Lightning`,
          url: `lightning:${bolt11}`,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* TopAppBar */}
      <header className="bg-surface w-full top-0 z-50 fixed">
        <div className="flex items-center justify-between px-6 h-16 bg-surface-container-low">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 transition-transform duration-150 p-2 rounded-full"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline font-bold tracking-tight text-primary text-lg">
              Payment Requested
            </h1>
          </div>
          <div className="text-xl font-black text-primary uppercase tracking-widest font-headline">
            Zapout
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 flex flex-col items-center max-w-md mx-auto min-h-screen">
        {/* Payment Toggle (Segmented Control) */}
        <div className="w-full bg-surface-container-low rounded-xl p-1 flex items-center mb-10 border border-outline/10">
          <button className="flex-1 py-2 px-4 rounded-lg bg-surface-container-high text-primary font-bold text-sm transition-all duration-200">
            Lightning
          </button>
          <button className="flex-1 py-2 px-4 rounded-lg text-on-surface-variant font-medium text-sm hover:text-on-surface transition-all duration-200">
            eCash (Cashu)
          </button>
        </div>

        {/* Centerpiece: QR Code Container */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-primary-container/10 blur-3xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity" />
          <div className="relative bg-surface-bright p-6 rounded-[2rem] glow-orange border border-primary-container/20">
            <div className="w-64 h-64 bg-white rounded-xl p-4 flex items-center justify-center">
              {bolt11 ? (
                <QRCodeSVG
                  value={bolt11}
                  size={224}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              ) : (
                <div className="text-gray-400">Kein Invoice</div>
              )}
            </div>
          </div>
        </div>

        {/* Amount & Status Section */}
        <div className="mt-10 text-center w-full">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-2">
              <span className="font-headline font-extrabold text-5xl tracking-tighter text-on-surface">
                {amountSats ? amountSats.toLocaleString() : '0'}
              </span>
              <span className="font-headline font-bold text-2xl text-primary-container">SATS</span>
            </div>
            <div className="font-body text-on-surface-variant font-medium tracking-wide">
              ≈ ${((amountSats || 0) * 0.00059).toFixed(2)} USD
            </div>
          </div>

          {/* Status Indicator */}
          <div className="mt-8 flex items-center justify-center gap-3 py-3 px-6 bg-surface-container-low rounded-full border border-outline/5">
            <div className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse shadow-[0_0_8px_rgba(0,182,254,0.5)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {statusMessage}
            </span>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4 w-full mt-12">
          <button
            onClick={handleCopyInvoice}
            className="flex items-center justify-center gap-3 bg-surface-container-high py-4 rounded-xl text-on-surface font-bold hover:bg-surface-container-highest transition-all active:scale-95 border border-outline/10"
          >
            <span className="material-symbols-outlined text-primary">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span className="text-sm">{copied ? 'Kopiert!' : 'Invoice kopieren'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-3 bg-surface-container-high py-4 rounded-xl text-on-surface font-bold hover:bg-surface-container-highest transition-all active:scale-95 border border-outline/10"
          >
            <span className="material-symbols-outlined text-primary">share</span>
            <span className="text-sm">Teilen</span>
          </button>
        </div>

        {/* Tonal Info Card */}
        <div className="w-full mt-8 p-4 bg-surface-container-lowest rounded-xl border border-primary-container/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Order ID
            </span>
            <span className="text-[10px] font-mono text-on-surface">{orderId || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Network Fee
            </span>
            <span className="text-[10px] font-mono text-tertiary">~1 sat</span>
          </div>
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 bg-surface-container-low z-50 border-t border-primary/10 shadow-[0_-4px_20px_0_rgba(247,147,26,0.05)]">
        <button className="flex flex-col items-center justify-center text-primary bg-surface-container-high rounded-xl py-1 px-4 active:scale-98 transition-all duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>
            bolt
          </span>
          <span className="font-inter text-[10px] font-bold uppercase tracking-wider mt-1">
            Lightning
          </span>
        </button>
        <button className="flex flex-col items-center justify-center text-on-surface/60 py-1 px-4 hover:text-primary active:scale-98 transition-all duration-200">
          <span className="material-symbols-outlined">payments</span>
          <span className="font-inter text-[10px] font-bold uppercase tracking-wider mt-1">
            eCash
          </span>
        </button>
        <button className="flex flex-col items-center justify-center text-on-surface/60 py-1 px-4 hover:text-primary active:scale-98 transition-all duration-200">
          <span className="material-symbols-outlined">history</span>
          <span className="font-inter text-[10px] font-bold uppercase tracking-wider mt-1">
            History
          </span>
        </button>
      </nav>

      {/* Inline styles for Material Symbols */}
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glow-orange {
          box-shadow: 0 0 40px 0 rgba(247, 147, 26, 0.15);
        }
      `}</style>
    </div>
  );
}
