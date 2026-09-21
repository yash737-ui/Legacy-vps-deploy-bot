import Database from 'better-sqlite3';

const db = new Database('bot_data.sqlite');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    userId TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT,
    password TEXT,
    isSuspended INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ownerId TEXT NOT NULL,
    nodeId TEXT NOT NULL,
    port INTEGER NOT NULL,
    password TEXT NOT NULL,
    expiresAt INTEGER,
    autoExpiry INTEGER DEFAULT 1,
    isSuspended INTEGER DEFAULT 0,
    sharedUsers TEXT DEFAULT '[]'
  );
`);

export default db;
