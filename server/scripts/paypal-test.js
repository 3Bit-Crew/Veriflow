// Tests the real PayPal money flow (sandbox): hold -> partial capture, and hold -> void.
// Uses the same functions as the server. Doesn't touch the database.
//
// 1) node scripts/paypal-test.js start <worker-business-sandbox-email>
//      creates 2 orders ($200 and $50) and prints 2 links
// 2) open each link, log in as the sandbox BUYER (personal account), click to approve
// 3) node scripts/paypal-test.js finish <orderId1> <orderId2>
//      order 1: hold $200, pay the worker $140 (partial)  -> $60 back to buyer
//      order 2: hold $50,  pay the worker $0   (void)     -> all back to buyer
import 'dotenv/config';
import { createOrder, authorizeOrder, captureAuthorization, voidAuthorization } from '../src/paypal/orders.js';
import { paypalRequest } from '../src/paypal/client.js';

const [cmd, ...args] = process.argv.slice(2);

try {
  if (cmd === 'start' && args[0]) {
    const ids = [];
    for (const amount of [200, 50]) {
      const fakeJob = { _id: `test-${Date.now()}`, title: `Veriflow test $${amount}`, amount, currency: 'USD', workerEmail: args[0] };
      const { orderId, approveUrl } = await createOrder(fakeJob, {
        returnUrl: 'https://example.com/?veriflow=approved',
        cancelUrl: 'https://example.com/?veriflow=cancelled'
      });
      ids.push(orderId);
      console.log(`$${amount} order ${orderId}\n  approve here: ${approveUrl}\n`);
    }
    console.log('How to approve (do it within ~1 hour, links expire):');
    console.log('  - open each link in a PRIVATE / incognito window');
    console.log('  - log in with the sandbox PERSONAL (buyer) account, not your real PayPal');
    console.log('  - click Continue. You land on an "Example Domain" page: that means it worked');
    console.log(`\nThen run: node scripts/paypal-test.js finish ${ids.join(' ')}`);
  } else if (cmd === 'finish' && args.length === 2) {
    const [partialOrder, voidOrder] = args;

    const a1 = await authorizeOrder(partialOrder);
    console.log(`Order 1 authorized (${a1.authStatus}), buyer ${a1.buyerEmail}. Capturing $140 of $200...`);
    const cap = await captureAuthorization(a1.authId, 140, 'USD', `test-capture-${a1.authId}`);
    console.log(`  capture ${cap.id}: ${cap.status}`);
    const after1 = await paypalRequest('GET', `/v2/payments/authorizations/${a1.authId}`);
    console.log(`  authorization is now ${after1.status} (rest released to buyer)`);

    const a2 = await authorizeOrder(voidOrder);
    console.log(`Order 2 authorized (${a2.authStatus}). Voiding...`);
    await voidAuthorization(a2.authId, `test-void-${a2.authId}`);
    const after2 = await paypalRequest('GET', `/v2/payments/authorizations/${a2.authId}`);
    console.log(`  authorization is now ${after2.status}`);

    console.log('\nPayPal partial capture and void both work.');
  } else {
    console.log('Usage:\n  node scripts/paypal-test.js start <worker-email>\n  node scripts/paypal-test.js finish <orderId1> <orderId2>');
  }
} catch (err) {
  console.error('FAILED:', err.message, err.paypal ? JSON.stringify(err.paypal.details) : '');
  process.exit(1);
}
