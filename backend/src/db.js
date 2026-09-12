const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'civiclens.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables with exact schema from spec
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_sections (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    heading TEXT,
    text TEXT NOT NULL,
    page INTEGER,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    locality TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    document_json TEXT,
    policy_json TEXT,
    impact_json TEXT,
    evidence_json TEXT,
    report_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL, -- 'neighborhood' | 'project' | 'policy' | 'department'
    target_value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS policy_alerts (
    id TEXT PRIMARY KEY,
    subscription_id TEXT,
    target_type TEXT NOT NULL,
    target_value TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'deadline' | 'new_policy' | 'budget_change' | 'public_hearing' | 'statutory_order'
    severity TEXT NOT NULL DEFAULT 'info', -- 'urgent' | 'high' | 'info'
    document_id TEXT,
    analysis_id TEXT,
    evidence_quote TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// Seed starter follows and alerts if subscriptions is empty
const subCount = db.prepare('SELECT COUNT(*) as cnt FROM subscriptions').get().cnt;
if (subCount === 0) {
  const now = new Date().toISOString();
  const insertSub = db.prepare(`
    INSERT INTO subscriptions (id, target_type, target_value, created_at, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const initialSubs = [
    { id: 'sub-neigh-1', type: 'neighborhood', val: 'Ward 150 Bellandur' },
    { id: 'sub-neigh-2', type: 'neighborhood', val: 'Greenway Corridor' },
    { id: 'sub-proj-1', type: 'project', val: 'Greenway Transit-Oriented Mixed-Use Overlay' },
    { id: 'sub-pol-1', type: 'policy', val: 'Mandatory Rainwater Harvesting (Sec 295A)' },
    { id: 'sub-pol-2', type: 'policy', val: 'Unit Area Value Property Tax (Sec 108A)' },
    { id: 'sub-dept-1', type: 'department', val: 'Bruhat Bengaluru Mahanagara Palike (BBMP)' },
    { id: 'sub-dept-2', type: 'department', val: 'Department of Urban Planning and Zoning Services' }
  ];

  for (const s of initialSubs) {
    insertSub.run(s.id, s.type, s.val, now);
  }

  const insertAlert = db.prepare(`
    INSERT INTO policy_alerts (id, subscription_id, target_type, target_value, title, summary, change_type, severity, evidence_quote, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const initialAlerts = [
    {
      id: 'alt-1',
      sub_id: 'sub-proj-1',
      type: 'project',
      val: 'Greenway Transit-Oriented Mixed-Use Overlay',
      title: '🚨 Objection Deadline Approaching: Greenway Corridor Overlay',
      summary: 'Public review comments and formal objections close on Friday, November 29, 2024 at 5:00 PM. Hearing scheduled for Dec 3, 2024.',
      change_type: 'deadline',
      severity: 'urgent',
      quote: 'Written comments will be accepted until 5:00 PM on November 29, 2024. Comments may be submitted by mail to City Hall, Room 304, or by email to planning@maplewoodcity.gov.'
    },
    {
      id: 'alt-2',
      sub_id: 'sub-pol-2',
      type: 'policy',
      val: 'Unit Area Value Property Tax (Sec 108A)',
      title: '💰 Tax Incentive Active: 5% Early Bird UAV Rebate',
      summary: 'Property tax payment window open under Section 108A. Pay full tax in the first month to claim an instant 5% statutory rebate on taxable value.',
      change_type: 'budget_change',
      severity: 'high',
      quote: 'If the property tax assessed is paid in one lump sum within one month from the commencement of the financial year, a rebate of five percent shall be allowed.'
    },
    {
      id: 'alt-3',
      sub_id: 'sub-pol-1',
      type: 'policy',
      val: 'Mandatory Rainwater Harvesting (Sec 295A)',
      title: '📜 Compliance Verification: Monsoon RWH Surcharge Warning',
      summary: 'Section 295A enforcement cycle initiated for residential plots over 2,400 sq. ft. Non-compliant connections face a 25% to 50% monthly water tariff surcharge.',
      change_type: 'new_policy',
      severity: 'high',
      quote: 'Whoever fails to provide rainwater harvesting structures within the stipulated time shall be liable to pay a surcharge equivalent to twenty-five percent of the water bill.'
    },
    {
      id: 'alt-4',
      sub_id: 'sub-neigh-1',
      type: 'neighborhood',
      val: 'Ward 150 Bellandur',
      title: '📅 Mandatory Ward Committee Monthly Consultation',
      summary: 'Ward 150 Committee will convene on the 1st Saturday of the month at the Ward Office to review civic works, waste segregation, and citizen petitions.',
      change_type: 'public_hearing',
      severity: 'info',
      quote: 'The Ward Committee shall meet at least once in a month. All decisions of the Ward Committee shall be taken by a majority of the members present.'
    }
  ];

  for (const a of initialAlerts) {
    insertAlert.run(a.id, a.sub_id, a.type, a.val, a.title, a.summary, a.change_type, a.severity, a.quote, now);
  }
}

module.exports = db;
