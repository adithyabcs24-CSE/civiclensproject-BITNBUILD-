const assert = require('assert');
const http = require('http');
const app = require('./index');

const PORT = 3098;
let server;

function post(urlPath, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `http://localhost:${PORT}${urlPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

function del(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${PORT}${urlPath}`, { method: 'DELETE' }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runAlertsVerification() {
  console.log('================================================================');
  console.log('       CIVICLENS AI — POLICY ALERTS VERIFICATION SUITE');
  console.log('================================================================\n');

  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 1. Check Subscriptions
    console.log('--- 1. Testing Subscriptions API ---');
    const subsRes = await get('/api/alerts/subscriptions');
    assert.strictEqual(subsRes.status, 200, 'GET /api/alerts/subscriptions must return 200');
    assert(Array.isArray(subsRes.data.subscriptions), 'Must return subscriptions array');
    console.log(`  [PASS] Initial subscriptions count: ${subsRes.data.subscriptions.length}`);

    const runId = Date.now().toString().slice(-4);
    // Follow all 4 types explicitly:
    const typesToTest = [
      { type: 'neighborhood', val: `Koramangala 4th Block #${runId}` },
      { type: 'project', val: `Lakeview District Stormwater Resilience Plan #${runId}` },
      { type: 'policy', val: `Solar Rooftop Mandate (Sec 310) #${runId}` },
      { type: 'department', val: `Bangalore Water Supply and Sewerage Board #${runId}` }
    ];

    const addedIds = [];
    for (const item of typesToTest) {
      const addRes = await post('/api/alerts/subscriptions', {
        target_type: item.type,
        target_value: item.val
      });
      assert.strictEqual(addRes.status, 201, `POST /api/alerts/subscriptions should return 201 for ${item.type}`);
      assert(addRes.data.subscription.id, 'Subscription ID must exist');
      addedIds.push(addRes.data.subscription.id);
      console.log(`  [PASS] Followed ${item.type}: "${item.val}" (ID: ${addRes.data.subscription.id})`);
    }

    // Test duplicate follow idempotency (should return 200)
    const dupRes = await post('/api/alerts/subscriptions', {
      target_type: typesToTest[0].type,
      target_value: typesToTest[0].val
    });
    assert.strictEqual(dupRes.status, 200, 'Duplicate follow should return 200 OK');
    console.log(`  [PASS] Duplicate follow idempotency verified: "${dupRes.data.message}"`);

    // 2. Check Alerts feed
    console.log('\n--- 2. Testing Alerts Feed API ---');
    const alertsRes = await get('/api/alerts');
    assert.strictEqual(alertsRes.status, 200, 'GET /api/alerts must return 200');
    assert(Array.isArray(alertsRes.data.alerts), 'Must return alerts array');
    assert(alertsRes.data.unread_count >= 0, 'Must return unread_count');
    console.log(`  [PASS] Current alerts: ${alertsRes.data.alerts.length} (Unread: ${alertsRes.data.unread_count})`);

    // Verify first alert structure
    const firstAlert = alertsRes.data.alerts[0];
    assert(firstAlert.title, 'Alert must have title');
    assert(firstAlert.summary, 'Alert must have summary');
    assert(firstAlert.evidence_quote, 'Alert must have evidence quote');
    assert(firstAlert.target_type, 'Alert must have target_type');
    console.log(`  [PASS] Verified alert structure: "${firstAlert.title}"`);

    // 3. Mark single alert as read
    console.log('\n--- 3. Testing Mark as Read ---');
    const readRes = await post(`/api/alerts/${firstAlert.id}/read`, {});
    assert.strictEqual(readRes.status, 200, 'POST /read must return 200');
    assert.strictEqual(readRes.data.success, true);
    console.log(`  [PASS] Alert ${firstAlert.id} marked as read. New unread count: ${readRes.data.unread_count}`);

    // 4. Simulate real-time policy alert based on active follows
    console.log('\n--- 4. Testing Live Policy Alert Simulation ---');
    const simRes = await post('/api/alerts/simulate', { subscription_id: addedIds[0] });
    assert.strictEqual(simRes.status, 201, 'POST /simulate must return 201');
    assert(simRes.data.alert.title, 'Simulated alert must contain title');
    console.log(`  [PASS] Live alert delivered: "${simRes.data.alert.title}" (Unread: ${simRes.data.unread_count})`);

    // 5. Unfollow subscription
    console.log('\n--- 5. Testing Unfollow Subscription ---');
    for (const subId of addedIds) {
      const delRes = await del(`/api/alerts/subscriptions/${subId}`);
      assert.strictEqual(delRes.status, 200, 'DELETE subscription must return 200');
      assert.strictEqual(delRes.data.success, true);
    }
    console.log(`  [PASS] Cleaned up all test subscriptions: ${addedIds.join(', ')}`);

    console.log('\n================================================================');
    console.log('  🎉 ALL POLICY ALERTS VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runAlertsVerification().catch(err => {
  console.error('Alerts Verification Failure:', err);
  if (server) server.close();
  process.exit(1);
});
