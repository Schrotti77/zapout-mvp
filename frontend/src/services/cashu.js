/**
 * Cashu Service for ZapOut
 * Uses backend API for Cashu operations
 */

const API_URL = 'http://localhost:8000';

// Default mint URL
const DEFAULT_CASHU_MINT = 'https://testnut.cashu.space';

class CashuService {
  constructor(mintUrl = DEFAULT_CASHU_MINT) {
    this.mintUrl = mintUrl;
  }

  /**
   * Get available mints
   */
  async getMints() {
    try {
      const res = await fetch(API_URL + '/cashu/mints');
      return await res.json();
    } catch (e) {
      console.error('Get mints error:', e);
      return [];
    }
  }

  /**
   * Get mint info
   */
  async getMintInfo(mintUrl = DEFAULT_CASHU_MINT) {
    try {
      const res = await fetch(API_URL + '/cashu/info?mint_url=' + encodeURIComponent(mintUrl));
      return await res.json();
    } catch (e) {
      console.error('Mint info error:', e);
      return { mint: mintUrl, working: false, error: e.message };
    }
  }

  /**
   * Create mint quote - get Lightning invoice
   */
  async createMintQuote(amount, mintUrl = DEFAULT_CASHU_MINT) {
    try {
      const res = await fetch(API_URL + '/cashu/mint-quote?amount_cents=' + (amount * 10) + '&mint_url=' + encodeURIComponent(mintUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (e) {
      console.error('Mint quote error:', e);
      return { error: e.message };
    }
  }

  /**
   * Check if mint quote is paid
   */
  async checkMintQuote(quoteId, mintUrl = DEFAULT_CASHU_MINT) {
    try {
      const res = await fetch(API_URL + '/cashu/quote-status?quote_id=' + quoteId + '&mint_url=' + encodeURIComponent(mintUrl));
      return await res.json();
    } catch (e) {
      console.error('Check quote error:', e);
      return { paid: false, error: e.message };
    }
  }

  /**
   * Receive Cashu tokens (after payment)
   */
  async receiveTokens(token, tokenOverride = null) {
    try {
      const res = await fetch(API_URL + '/cashu/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, token: tokenOverride })
      });
      return await res.json();
    } catch (e) {
      console.error('Receive tokens error:', e);
      return { error: e.message, success: false };
    }
  }

  /**
   * Verify Cashu token (NUT-07)
   */
  async verifyToken(token) {
    try {
      const res = await fetch(API_URL + '/cashu/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      });
      return await res.json();
    } catch (e) {
      console.error('Verify token error:', e);
      return { valid: false, error: e.message };
    }
  }

  /**
   * Melt tokens - pay Lightning with Cashu
   */
  async meltTokens(invoice, token) {
    try {
      const res = await fetch(API_URL + '/cashu/melt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: invoice, token: token })
      });
      return await res.json();
    } catch (e) {
      console.error('Melt error:', e);
      return { error: e.message, success: false };
    }
  }

  /**
   * Get balance
   */
  async getBalance() {
    try {
      const res = await fetch(API_URL + '/cashu/balance');
      const data = await res.json();
      return data.balance || 0;
    } catch (e) {
      console.error('Balance error:', e);
      return 0;
    }
  }
}

// Export singleton instance
const cashuService = new CashuService();

export default cashuService;
export { CashuService };

// ============================================
// LocalStorage Proof & Transaction Management
// ============================================

const PROOFS_KEY = 'zapout_cashu_proofs';
const HISTORY_KEY = 'zapout_cashu_history';

export const proofStorage = {
  /**
   * Get all proofs from localStorage
   */
  getAll() {
    try {
      const data = localStorage.getItem(PROOFS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading proofs:', e);
      return [];
    }
  },

  /**
   * Save proofs to localStorage
   */
  save(proofs) {
    try {
      const existing = this.getAll();
      // Deduplicate by secret
      const existingSecrets = new Set(existing.map(p => p.secret));
      const newProofs = proofs.filter(p => !existingSecrets.has(p.secret));
      const updated = [...existing, ...newProofs];
      localStorage.setItem(PROOFS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving proofs:', e);
      return [];
    }
  },

  /**
   * Remove proofs that were used (spent)
   */
  remove(secrets) {
    try {
      const secretsToRemove = new Set(secrets);
      const remaining = this.getAll().filter(p => !secretsToRemove.has(p.secret));
      localStorage.setItem(PROOFS_KEY, JSON.stringify(remaining));
      return remaining;
    } catch (e) {
      console.error('Error removing proofs:', e);
      return [];
    }
  },

  /**
   * Calculate total balance from proofs
   */
  getBalance() {
    const proofs = this.getAll();
    return proofs.reduce((sum, p) => sum + (p.amount || 0), 0);
  },

  /**
   * Get proofs grouped by denomination
   */
  getDenominations() {
    const proofs = this.getAll();
    const groups = {};
    proofs.forEach(p => {
      const amt = p.amount || 0;
      groups[amt] = (groups[amt] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([amount, count]) => ({ amount: Number(amount), count }))
      .sort((a, b) => a.amount - b.amount);
  },

  /**
   * Clear all proofs
   */
  clear() {
    localStorage.setItem(PROOFS_KEY, JSON.stringify([]));
  }
};

export const txHistory = {
  /**
   * Get transaction history
   */
  getAll() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Add transaction to history
   */
  add(type, amount, details = {}) {
    try {
      const history = this.getAll();
      const entry = {
        id: crypto.randomUUID?.() || Date.now().toString(36),
        timestamp: Date.now(),
        type, // 'mint', 'receive', 'send', 'melt'
        amount,
        ...details
      };
      history.unshift(entry);
      // Keep last 100 transactions
      const trimmed = history.slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      return entry;
    } catch (e) {
      console.error('Error adding tx:', e);
      return null;
    }
  },

  /**
   * Clear history
   */
  clear() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  }
};
