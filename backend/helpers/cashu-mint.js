const { Mint } = require('@cashu/cashu-ts');

async function mintTokens(mintUrl, quoteId) {
  const mint = new Mint(mintUrl);

  try {
    // Check if paid
    const quote = await mint.checkMintQuoteBolt11(quoteId);
    console.log('Quote status:', JSON.stringify(quote));

    if (quote.state !== 'PAID') {
      return { error: 'Quote not paid', state: quote.state };
    }

    // Mint tokens using the quote
    const result = await mint.mintBolt11(quote.amount, quoteId);
    console.log('Mint result:', JSON.stringify(result));

    const proofs = result.proofs || [];

    return {
      success: true,
      proofs: proofs,
      total_sats: proofs.reduce((sum, p) => sum + p.amount, 0),
    };
  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
}

// CLI interface
const args = process.argv.slice(2);
if (args[0] === 'mint' && args[1] && args[2]) {
  mintTokens(args[1], args[2]).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.error ? 1 : 0);
  });
}
