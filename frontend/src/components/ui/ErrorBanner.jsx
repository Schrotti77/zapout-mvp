/**
 * ErrorBanner - User-friendly error display
 * Following fullstack-dev: Map API errors to human-readable messages
 */

import { getErrorMessage } from '../../lib/api.js';

/**
 * Error Alert - inline error message
 */
export function ErrorAlert({ error, onRetry, className = '' }) {
  if (!error) return null;

  const message = getErrorMessage(error);

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-red-700">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Erneut versuchen
            </button>
          )}
        </div>
        <button
          onClick={() => error && (error.handled = true)}
          className="flex-shrink-0 text-red-400 hover:text-red-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Error Banner - full-width error message
 */
export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;

  const message = getErrorMessage(error);

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{message}</span>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium"
          >
            Erneut versuchen
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Error Card - centered error with icon
 */
export function ErrorCard({ error, title = 'Fehler', onRetry, className = '' }) {
  if (!error) return null;

  const message = getErrorMessage(error);

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

/**
 * Toast - temporary error/success notification
 */
import { useState, useEffect } from 'react';

export function Toast({ message, type = 'error', duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    error: 'bg-red-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 ${
        colors[type]
      } text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span>{message}</span>
      <button onClick={() => setVisible(false)} className="hover:opacity-80">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
