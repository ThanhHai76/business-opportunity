'use strict';
/**
 * `npm run payos:webhook -- https://your-domain/api/billing/webhook/payos` — registers the address PayOS sends payments
 * to (PayOS first sends a test payment there, so the server must be running at that address with BILLING_PROVIDER=payos).
 * Reads the PAYOS_* keys from the environment or the .env of the server.
 */
try {
  process.loadEnvFile(); // the .env of the server (Node >= 20.12); real environment variables win
} catch {
  /* no .env file */
}
const { createPayosProvider } = require('../src/billing/payos-provider');

const url = process.argv[2];
if (!url || !/^https:\/\/[^/]+\/api\/billing\/webhook\/payos$/.test(url)) {
  console.error('Usage: npm run payos:webhook -- https://your-domain/api/billing/webhook/payos');
  process.exit(1);
}

createPayosProvider()
  .confirmWebhook(url)
  .then((data) => console.log(`PayOS will send payments to ${data.webhookUrl ?? url} (channel: ${data.name ?? data.accountName ?? '?'}).`))
  .catch((error) => {
    console.error(`PayOS refused: ${error.message}. Is the server running at that address with BILLING_PROVIDER=payos?`);
    process.exit(1);
  });
