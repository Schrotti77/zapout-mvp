/**
 * Cashu Client - v2 API (using cashu-ts 2.0.0)
 * Reference: https://github.com/cashubtc/cashu-ts
 */

const { CashuMint, CashuWallet } = require('@cashu/cashu-ts');

const MINT_URL = process.env.CASHU_MINT_URL || 'https://testnut.cashu.space';

// Initialize
let mint = null;
let wallet = null;

/**
 * Initialize the Cashu client
 */
function init(customMintUrl = null) {
  mint = new CashuMint(customMintUrl || MINT_URL);
  wallet = new CashuWallet(mint);
  return { mint, wallet };
}

/**
 * Get mint information
 */
async function getMintInfo() {
  try {
    if (!mint) init();
    const info = await mint.getInfo();
    return { success: true, data: info };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a mint quote (v2 API)
 * Returns a Lightning invoice that needs to be paid
 */
async function createMintQuote(amount, unit = 'sat') {
  try {
    if (!mint) init();
    
    // v2 API: createMintQuote returns { quote, request, state, ... }
    const quote = await wallet.createMintQuote(amount);
    
    return {
      success: true,
      data: {
        quote: quote.quote,
        request: quote.request,  // bolt11 invoice
        amount: quote.amount,
        unit: quote.unit,
        state: quote.state,
        expiry: quote.expiry,
        paid: quote.paid || false
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mint proofs after quote is paid (v2 API)
 */
async function mintProofs(amount, quote) {
  try {
    if (!mint) init();
    
    // v2 API: mintProofs returns array directly (not {proofs: [...]})
    const result = await wallet.mintProofs(amount, quote);
    
    // Handle both array and object response
    const proofs = Array.isArray(result) ? result : (result.proofs || []);
    
    return {
      success: true,
      data: {
        proofs: proofs,
        count: proofs.length,
        totalAmount: proofs.reduce((s, p) => s + (p.amount || 0), 0)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check quote status
 */
async function getQuoteStatus(quote) {
  try {
    if (!mint) init();
    
    // The quote object already has state, but we can check again
    // Note: v2 API doesn't have explicit check, state is in quote object
    // We can create a new quote and compare, or just return the last known state
    return { success: true, data: { quote, note: 'State available in quote object' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get wallet keysets
 */
async function getKeysets() {
  try {
    if (!mint) init();
    const keysets = await mint.getKeySets();
    return { success: true, data: keysets };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get keys for a keyset
 */
async function getKeys(keysetId) {
  try {
    if (!mint) init();
    const keys = await mint.getKeys(keysetId);
    return { success: true, data: keys };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Decode a Cashu token
 */
function decodeToken(token) {
  try {
    const { getDecodedToken } = require('@cashu/cashu-ts');
    const decoded = getDecodedToken(token);
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send tokens (split/proof)
 */
async function sendTokens(amount, proofs) {
  try {
    if (!mint) init();
    const { send, keep } = await wallet.send(amount, proofs);
    return { success: true, data: { send, keep } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Receive tokens (from encoded token)
 */
async function receiveTokens(encodedToken) {
  try {
    if (!mint) init();
    const { getDecodedToken } = require('@cashu/cashu-ts');
    const proofs = await wallet.receive(encodedToken);
    return { success: true, data: proofs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check proof states
 */
async function checkProofs(proofs) {
  try {
    if (!mint) init();
    const states = await wallet.checkProofsStates(proofs);
    return { success: true, data: states };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Melt proofs (pay Lightning invoice)
 */
async function meltProofs(bolt11Invoice, proofs) {
  try {
    if (!mint) init();
    const result = await wallet.meltProofs(bolt11Invoice, proofs);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get balance from proofs
 */
function getBalance(proofs) {
  if (!proofs || !Array.isArray(proofs)) return 0;
  return proofs.reduce((sum, p) => sum + (p.amount || 0), 0);
}

// CLI Interface for Python to call
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'mint-proofs') {
      // Usage: node cashu-client.js mint-proofs <amount> <quote> [mintUrl]
      const amount = parseInt(args[1]);
      const quote = args[2];
      const mintUrl = args[3] || MINT_URL;
      
      init(mintUrl);
      const result = await mintProofs(amount, quote);
      console.log(JSON.stringify(result));
      process.exit(result.success ? 0 : 1);
    } 
    else if (command === 'create-quote') {
      // Usage: node cashu-client.js create-quote <amount> [mintUrl]
      const amount = parseInt(args[1]);
      const mintUrl = args[2] || MINT_URL;
      
      init(mintUrl);
      const result = await createMintQuote(amount);
      console.log(JSON.stringify(result));
      process.exit(result.success ? 0 : 1);
    }
    else if (command === 'check-quote') {
      // Usage: node cashu-client.js check-quote <quote> [mintUrl]
      const quote = args[1];
      const mintUrl = args[2] || MINT_URL;
      
      init(mintUrl);
      const result = await getQuoteStatus(quote);
      console.log(JSON.stringify(result));
      process.exit(result.success ? 0 : 1);
    }
    else {
      console.error('Unknown command:', command);
      console.error('Available: mint-proofs, create-quote, check-quote');
      process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  cli();
}

// Initialize on load
init();

module.exports = {
  MINT_URL,
  init,
  getMintInfo,
  createMintQuote,
  mintProofs,
  getQuoteStatus,
  getKeysets,
  getKeys,
  decodeToken,
  sendTokens,
  receiveTokens,
  checkProofs,
  meltProofs,
  getBalance
};
