import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useWebSocket - Custom hook for WebSocket connections (NUT-17)
 *
 * @param {string} url - WebSocket URL (e.g., ws://localhost:8000/ws/payments/123)
 * @param {object} options
 * @param {function} options.onMessage - Callback for received messages
 * @param {function} options.onConnect - Callback when connected
 * @param {function} options.onDisconnect - Callback when disconnected
 * @param {function} options.onError - Callback for errors
 * @param {boolean} options.enabled - Enable/disable the connection
 */
export function useWebSocket(url, options = {}) {
  const { onMessage, onConnect, onDisconnect, onError, enabled = true } = options;

  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(() => {
    if (!enabled || !url || status === 'connecting' || status === 'connected') {
      return;
    }

    setStatus('connecting');
    console.log(`[WS] Connecting to ${url}...`);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WS] Connected');
        setStatus('connected');
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
          setLastMessage({ type: 'raw', data: event.data });
        }
      };

      ws.onerror = error => {
        console.error('[WS] Error:', error);
        setStatus('error');
        onError?.(error);
      };

      ws.onclose = event => {
        console.log(`[WS] Disconnected (code: ${event.code})`);
        setStatus('disconnected');
        onDisconnect?.(event);

        // Auto-reconnect if enabled and not a clean close
        if (enabled && event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          console.log(
            `[WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] Connection error:', e);
      setStatus('error');
      onError?.(e);
    }
  }, [url, enabled, status, onMessage, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const send = useCallback(data => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  // Connect when URL changes or enabled changes
  useEffect(() => {
    if (enabled && url) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [url, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);

  return {
    status,
    lastMessage,
    send,
    disconnect,
    reconnect: connect,
    isConnected: status === 'connected',
  };
}

export default useWebSocket;
