import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// 環境変数から DB パスを取得。なければデフォルト
const dbPath =  process.env.DB_PATH+'label.db' || '/data/label.db'

// DB ディレクトリが存在しなければ作る
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// SQLite DB インスタンスを作成
export const db = new Database(dbPath);
console.log(`Database initialized at: ${dbPath}`);

// --- テーブル作成 ---s
db.prepare(`
  CREATE TABLE IF NOT EXISTS cursor (
    name TEXT PRIMARY KEY,
    value INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS like (
    rkey TEXT PRIMARY KEY,
    subject TEXT,
    createdAt TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS post (
    rkey TEXT PRIMARY KEY,
    label TEXT,
    condition TEXT,
    appliedTo TEXT,
    action TEXT,
    durationInHours INTEGER,
    createdAt TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS random (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS like_subject (
    subjectUri TEXT PRIMARY KEY,
    rkey TEXT
  )
`).run();

// --- Cursor ---
export function getCursor(): number {
  const stmt = db.prepare('SELECT value FROM cursor WHERE name = ?');
  const row = stmt.get('main') as { value: number } | undefined;
  return row ? row.value : Math.floor(Date.now() * 1000);
}

export function setCursor(value: number) {
  db.prepare(`
    INSERT INTO cursor (name, value)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET value=excluded.value
  `).run('main', value);
}

// --- Like ---
export function upsertLike(rkey: string, subject: string, createdAt: string) {
  db.prepare(`
    INSERT INTO like (rkey, subject, createdAt)
    VALUES (?, ?, ?)
    ON CONFLICT(rkey) DO UPDATE SET
      subject=excluded.subject,
      createdAt=excluded.createdAt
  `).run(rkey, subject, createdAt);
}

export function deleteLike(rkey: string) {
  db.prepare('DELETE FROM like WHERE rkey = ?').run(rkey);
}


// --- Post ---
export function upsertPost(rkey: string, data: {
  label: string;
  condition: string;
  appliedTo: string;
  action?: string;
  durationInHours: number;
  createdAt: string;
}) {
  db.prepare(`
    INSERT INTO post (rkey, label, condition, appliedTo, action, durationInHours, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(rkey) DO UPDATE SET
      label=excluded.label,
      condition=excluded.condition,
      appliedTo=excluded.appliedTo,
      action=excluded.action,
      durationInHours=excluded.durationInHours,
      createdAt=excluded.createdAt
  `).run(rkey, data.label, data.condition, data.appliedTo, data.action, data.durationInHours, data.createdAt);
}

export function deletePost(rkey: string) {
  db.prepare('DELETE FROM post WHERE rkey = ?').run(rkey);
}

// --- Random ---
export function upsertRandom(rkey: string, value: any) {
  db.prepare(`
    INSERT INTO random (rkey, value)
    VALUES (?, ?)
    ON CONFLICT(rkey) DO UPDATE SET value=excluded.value
  `).run(rkey, JSON.stringify(value));
}

export function deleteRandom(rkey: string) {
  db.prepare('DELETE FROM random WHERE rkey = ?').run(rkey);
}

/**
 * 投稿URIに対応するLikeの登録または更新
 * @param subjectUri 投稿のURI (主キー)
 * @param rkey Like自体のID
 */
export function upsertLikeSubject(subjectUri: string, rkey: string) {
  db.prepare(`
    INSERT INTO like_subject (subjectUri, rkey)
    VALUES (?, ?)
    ON CONFLICT(subjectUri) DO UPDATE SET rkey = excluded.rkey
  `).run(subjectUri, rkey);
}

/**
 * 投稿URIに対応するLikeを削除
 * @param subjectUri 投稿のURI
 */
export function deleteLikeSubject(subjectUri: string) {
  db.prepare('DELETE FROM like_subject WHERE subjectUri = ?').run(subjectUri);
}
