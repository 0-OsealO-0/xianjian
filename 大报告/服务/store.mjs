/* 先见 · 数据层（零依赖，Node 22+ 内置 node:sqlite）
   三张表：users / sessions / feedback / events
   原则：只存必要的，能删就删干净（DELETE /api/me 会级联删）。
*/

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const DIR = path.join(import.meta.dirname, "data");
mkdirSync(DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DIR, "app.db"));

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  salt         TEXT NOT NULL,
  hash         TEXT NOT NULL,
  consented_at INTEGER,
  consent_ver  TEXT,
  created_at   INTEGER NOT NULL,
  last_seen    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER,
  scope      TEXT,
  rating     INTEGER,
  body       TEXT NOT NULL,
  contact    TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER,
  type       TEXT NOT NULL,
  payload    TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(created_at);
`);

/* ── 密码 ── */
export function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(pw, salt, hash) {
  const a = Buffer.from(scryptSync(pw, salt, 64).toString("hex"), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── 用户 ── */
export function createUser(email, pw, consented, consentVer) {
  const { salt, hash } = hashPassword(pw);
  const now = Date.now();
  const info = db
    .prepare(
      "INSERT INTO users (email, salt, hash, consented_at, consent_ver, created_at, last_seen) VALUES (?,?,?,?,?,?,?)"
    )
    .run(email, salt, hash, consented ? now : null, consented ? consentVer : null, now, now);
  return Number(info.lastInsertRowid);
}

export function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
}

export function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export function setConsent(userId, consented, consentVer) {
  if (consented) {
    db.prepare("UPDATE users SET consented_at = ?, consent_ver = ? WHERE id = ?").run(
      Date.now(),
      consentVer,
      userId
    );
  } else {
    db.prepare("UPDATE users SET consented_at = NULL, consent_ver = NULL WHERE id = ?").run(userId);
  }
}

export function touchUser(userId) {
  db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(Date.now(), userId);
}

export function deleteUser(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM feedback WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM events WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

/* ── 会话 ── */
const DAY = 24 * 60 * 60 * 1000;

export function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)").run(
    token,
    userId,
    now,
    now + 30 * DAY
  );
  return token;
}

export function userBySession(token) {
  if (!token) return null;
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return findUserById(row.user_id);
}

export function dropSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/* ── 反馈与事件 ── */
export function addFeedback({ userId, scope, rating, body, contact }) {
  const info = db
    .prepare("INSERT INTO feedback (user_id, scope, rating, body, contact, created_at) VALUES (?,?,?,?,?,?)")
    .run(userId || null, scope || null, rating || null, body, contact || null, Date.now());
  return Number(info.lastInsertRowid);
}

export function feedbackOf(userId) {
  return db
    .prepare("SELECT id, scope, rating, body, created_at FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 50")
    .all(userId);
}

export function addEvent(userId, type, payload) {
  db.prepare("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)").run(
    userId || null,
    type,
    payload ? JSON.stringify(payload) : null,
    Date.now()
  );
}


export function listAllFeedback(limit) {
  return db
    .prepare(
      "SELECT f.id, f.scope, f.rating, f.body, f.created_at, u.email FROM feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT ?"
    )
    .all(limit || 200);
}

/* ── 汇总（只出数字，不出人） ── */
export function stats() {
  const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args) || {})[0] || 0;
  const since = Date.now() - 7 * DAY;
  return {
    users: one("SELECT COUNT(*) AS n FROM users"),
    consented: one("SELECT COUNT(*) AS n FROM users WHERE consented_at IS NOT NULL"),
    active7d: one("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE created_at > ?", since),
    feedback: one("SELECT COUNT(*) AS n FROM feedback"),
    events7d: one("SELECT COUNT(*) AS n FROM events WHERE created_at > ?", since),
  };
}

/* ── 保留期：反馈与事件最多 12 个月，过期会话一并清掉 ── */
export function purgeOld() {
  const cut = Date.now() - 365 * DAY;
  const f = db.prepare("DELETE FROM feedback WHERE created_at < ?").run(cut).changes;
  const e = db.prepare("DELETE FROM events WHERE created_at < ?").run(cut).changes;
  const s = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now()).changes;
  return { feedback: Number(f || 0), events: Number(e || 0), sessions: Number(s || 0) };
}
