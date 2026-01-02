import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = process.env.DB_PATH
  ? path.join(process.env.DB_PATH, 'labeling.db')
  : path.join('/data', 'labeling.db');
  
// SQLite DB インスタンスを作成
console.log(dbPath)
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

db.prepare(`
  CREATE TABLE IF NOT EXISTS preference_records (
    nsid TEXT PRIMARY KEY,
    value TEXT
  )
`).run();


/**
 * preference を取得
 * 存在しない場合は null を返す
 */
export function getPreference(nsid: string): string | null {
  const stmt = db.prepare(
    'SELECT value FROM preference_records WHERE nsid = ?'
  );

  const row = stmt.get(nsid) as { value: string } | undefined;
  return row ? row.value : null;
}


/**
 * preference を保存
 */
export function setPreference(nsid: string, value: string): void {
  db.prepare(`
    INSERT INTO preference_records (nsid, value)
    VALUES (?, ?)
    ON CONFLICT(nsid)
    DO UPDATE SET value = excluded.value
  `).run(nsid, value);
}

/**
 * preference を削除
 */
export function deletePreference(nsid: string): void {
  db.prepare(`
    DELETE FROM preference_records
    WHERE nsid = ?
  `).run(nsid);
}

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
