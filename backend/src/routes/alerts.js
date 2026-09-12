const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// ──────────────────────────────────────────────
// GET /api/alerts
// List policy alerts with unread counter
// ──────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { unread, target_type } = req.query;

    let query = 'SELECT * FROM policy_alerts WHERE 1=1';
    const params = [];

    if (unread === 'true') {
      query += ' AND read = 0';
    }

    if (target_type) {
      query += ' AND target_type = ?';
      params.push(target_type);
    }

    query += ' ORDER BY created_at DESC';

    const alerts = db.prepare(query).all(...params);
    const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM policy_alerts WHERE read = 0').get().cnt;

    res.json({
      alerts,
      unread_count: unreadCount,
      total_count: alerts.length
    });
  } catch (err) {
    console.error('GET /api/alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/alerts/:id/read
// Mark an individual alert as read
// ──────────────────────────────────────────────
router.post('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('UPDATE policy_alerts SET read = 1 WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }
    const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM policy_alerts WHERE read = 0').get().cnt;
    res.json({ success: true, alert_id: id, unread_count: unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/alerts/mark-all-read
// Mark all alerts as read
// ──────────────────────────────────────────────
router.post('/mark-all-read', (_req, res) => {
  try {
    db.prepare('UPDATE policy_alerts SET read = 1').run();
    res.json({ success: true, unread_count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/alerts/subscriptions
// List all active subscriptions
// ──────────────────────────────────────────────
router.get('/subscriptions', (_req, res) => {
  try {
    const subs = db.prepare('SELECT * FROM subscriptions WHERE active = 1 ORDER BY created_at DESC').all();
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/alerts/subscriptions
// Follow a neighborhood, project, policy, or department
// ──────────────────────────────────────────────
router.post('/subscriptions', (req, res) => {
  try {
    const { target_type, target_value } = req.body;

    const validTypes = ['neighborhood', 'project', 'policy', 'department'];
    if (!target_type || !validTypes.includes(target_type)) {
      return res.status(400).json({
        error: `Invalid target_type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    if (!target_value || !String(target_value).trim()) {
      return res.status(400).json({ error: 'target_value cannot be empty.' });
    }

    const cleanVal = String(target_value).trim();

    // Check if subscription already exists
    const existing = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE target_type = ? AND LOWER(target_value) = LOWER(?)
    `).get(target_type, cleanVal);

    if (existing) {
      if (existing.active === 0) {
        db.prepare('UPDATE subscriptions SET active = 1 WHERE id = ?').run(existing.id);
      }
      return res.status(200).json({
        subscription: { ...existing, active: 1 },
        message: `Already following ${target_type}: "${cleanVal}"`
      });
    }

    const id = `sub-${target_type.slice(0, 4)}-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO subscriptions (id, target_type, target_value, created_at, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, target_type, cleanVal, now);

    res.status(201).json({
      subscription: {
        id,
        target_type,
        target_value: cleanVal,
        created_at: now,
        active: 1
      },
      message: `Now following ${target_type}: "${cleanVal}"`
    });
  } catch (err) {
    console.error('POST /api/alerts/subscriptions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/alerts/subscriptions/:id
// Unfollow a subscription
// ──────────────────────────────────────────────
router.delete('/subscriptions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }
    res.json({ success: true, unfollowed_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/alerts/simulate
// Simulate a new real-time policy alert based on active subscriptions
// ──────────────────────────────────────────────
router.post('/simulate', (req, res) => {
  try {
    const subs = db.prepare('SELECT * FROM subscriptions WHERE active = 1').all();
    if (subs.length === 0) {
      return res.status(400).json({ error: 'No active subscriptions found. Follow a topic first!' });
    }

    // Pick a random or specified subscription
    const sub = req.body.subscription_id 
      ? subs.find(s => s.id === req.body.subscription_id) || subs[0]
      : subs[Math.floor(Math.random() * subs.length)];

    const id = `alt-sim-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    let title = '';
    let summary = '';
    let quote = '';
    let severity = 'high';
    let change_type = 'new_policy';

    if (sub.target_type === 'neighborhood') {
      title = `📢 Civic Notification for ${sub.target_value}`;
      summary = `New ward infrastructure development and stormwater upgrade scheduled for execution in ${sub.target_value}.`;
      quote = `Municipal works allocation of ₹2.4 Crores approved for localized ward enhancements pursuant to Section 13H consultative mandate.`;
      change_type = 'statutory_order';
      severity = 'high';
    } else if (sub.target_type === 'project') {
      title = `⚡ Public Timeline Update: ${sub.target_value}`;
      summary = `The review board has published updated procedural timelines and environmental mitigation reports for ${sub.target_value}.`;
      quote = `Public review comments shall be registered with the Planning Clerk prior to final administrative sign-off.`;
      change_type = 'deadline';
      severity = 'urgent';
    } else if (sub.target_type === 'policy') {
      title = `📜 Statutory Clarification: ${sub.target_value}`;
      summary = `Administrative circular issued detailing inspection guidelines and penalty waivers for ${sub.target_value}.`;
      quote = `All premise owners qualifying under Section criteria are granted a 30-day compliance grace period before enforcement surcharges take effect.`;
      change_type = 'new_policy';
      severity = 'high';
    } else {
      title = `🏛️ Department Bulletin: ${sub.target_value}`;
      summary = `${sub.target_value} announced new online portal for grievance registrations and citizen tracking.`;
      quote = `Citizens can now file direct objections and track ward engineer site inspections digitally within 7 business days.`;
      change_type = 'public_hearing';
      severity = 'info';
    }

    db.prepare(`
      INSERT INTO policy_alerts (id, subscription_id, target_type, target_value, title, summary, change_type, severity, evidence_quote, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, sub.id, sub.target_type, sub.target_value, title, summary, change_type, severity, quote, now);

    const newAlert = db.prepare('SELECT * FROM policy_alerts WHERE id = ?').get(id);
    const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM policy_alerts WHERE read = 0').get().cnt;

    res.status(201).json({
      alert: newAlert,
      unread_count: unreadCount,
      message: `New alert generated for ${sub.target_type}: "${sub.target_value}"`
    });
  } catch (err) {
    console.error('POST /api/alerts/simulate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
