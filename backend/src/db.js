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
`);

module.exports = db;
