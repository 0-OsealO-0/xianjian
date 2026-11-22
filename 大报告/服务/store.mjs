/* 先见 · 数据层（零依赖）
   两种后端，同一套接口：
     · 本地：node:sqlite（Node 22+），数据落 大报告/服务/data/app.db
     · 线上：Cloudflare D1 的 HTTP API（Render 免费实例没有持久磁盘，D1 免费且持久）

   选中 D1 的条件：环境变量里有 CLOUDFLARE_API_TOKEN 与 D1_DATABASE_ID。
   接口全部是 async，调用方一律 await。

   三张表：users / sessions / feedback / events
   原则：只存必要的，能删就删干净（DELETE /api/me 会级联删）。
*/

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const DAY = 24 * 60 * 60 * 1000;

/* ── 后端选择 ── */
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const D1_DB = process.env.D1_DATABASE_ID || "";
export const usingD1 = !!(CF_TOKEN && CF_ACCOUNT && D1_DB);

let localExec = null; // (sql, params) => [{...}]

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    salt         TEXT NOT NULL,
    hash         TEXT NOT NULL,
    consented_at INTEGER,
    consent_ver  TEXT,
    created_at   INTEGER NOT NULL,
    last_seen    INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER,
    scope      TEXT,
    rating     INTEGER,
    body       TEXT NOT NULL,
    contact    TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER,
    type       TEXT NOT NULL,
    payload    TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_at ON feedback(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_at ON events(created_at)`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at)`,
];

/* ── D1 HTTP ── */
async function d1Query(sql, params) {
  const url =
    "https://api.cloudflare.com/client/v4/accounts/" +
    CF_ACCOUNT +
    "/d1/database/" +
    D1_DB +
    "/query";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      authorization: "Bearer " + CF_TOKEN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.success) {
    const msg = (data.errors && data.errors[0] && data.errors[0].message) || "d1 " + r.status;
    throw new Error(msg);
  }
  const first = (data.result && data.result[0]) || {};
  const rows = first.results || [];
  const meta = first.meta || {};
  return { rows, meta };
}

/* ── 统一执行：返回 { rows, lastId, changes } ── */
async function q(sql, params) {
  if (usingD1) {
    const { rows, meta } = await d1Query(sql, params);
    return {
      rows,
      lastId: meta.last_row_id != null ? Number(meta.last_row_id) : null,
      changes: meta.changes != null ? Number(meta.changes) : null,
    };
  }
  return localExec(sql, params || []);
}

/* ── 初始化 ── */
export async function init() {
  if (usingD1) {
    for (const sql of SCHEMA) await d1Query(sql, []);
    return "d1";
  }
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const path = await import("node:path");
  const DIR = path.join(import.meta.dirname, "data");
  mkdirSync(DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DIR, "app.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  for (const sql of SCHEMA) db.exec(sql);
  localExec = (sql, params) => {
    const stmt = db.prepare(sql);
    const head = sql.trim().slice(0, 6).toUpperCase();
    if (head === "SELECT") return { rows: stmt.all(...params), lastId: null, changes: null };
    const info = stmt.run(...params);
    return {
      rows: [],
      lastId: Number(info.lastInsertRowid),
      changes: Number(info.changes),
    };
  };
  return "sqlite";
}

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
export async function createUser(email, pw, consented, consentVer) {
  const { salt, hash } = hashPassword(pw);
  const now = Date.now();
  const r = await q(
    "INSERT INTO users (email, salt, hash, consented_at, consent_ver, created_at, last_seen) VALUES (?,?,?,?,?,?,?)",
    [email, salt, hash, consented ? now : null, consented ? consentVer : null, now, now]
  );
  return r.lastId;
}

export async function findUserByEmail(email) {
  const { rows } = await q("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await q("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function setConsent(userId, consented, consentVer) {
  if (consented) {
    await q("UPDATE users SET consented_at = ?, consent_ver = ? WHERE id = ?", [
      Date.now(),
      consentVer,
      userId,
    ]);
  } else {
    await q("UPDATE users SET consented_at = NULL, consent_ver = NULL WHERE id = ?", [userId]);
  }
}

export async function touchUser(userId) {
  await q("UPDATE users SET last_seen = ? WHERE id = ?", [Date.now(), userId]);
}

export async function deleteUser(userId) {
  await q("DELETE FROM sessions WHERE user_id = ?", [userId]);
  await q("DELETE FROM progress WHERE user_id = ?", [userId]);
  await q("DELETE FROM feedback WHERE user_id = ?", [userId]);
  await q("DELETE FROM events WHERE user_id = ?", [userId]);
  await q("DELETE FROM users WHERE id = ?", [userId]);
}

/* ── 会话 ── */
export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await q("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)", [
    token,
    userId,
    now,
    now + 30 * DAY,
  ]);
  return token;
}

export async function userBySession(token) {
  if (!token) return null;
  const { rows } = await q("SELECT * FROM sessions WHERE token = ?", [token]);
  const row = rows[0];
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) {
    await q("DELETE FROM sessions WHERE token = ?", [token]);
    return null;
  }
  return findUserById(row.user_id);
}

export async function dropSession(token) {
  if (token) await q("DELETE FROM sessions WHERE token = ?", [token]);
}

/* ── 反馈与事件 ── */
export async function addFeedback({ userId, scope, rating, body, contact }) {
  const r = await q(
    "INSERT INTO feedback (user_id, scope, rating, body, contact, created_at) VALUES (?,?,?,?,?,?)",
    [userId || null, scope || null, rating || null, body, contact || null, Date.now()]
  );
  return r.lastId;
}

export async function feedbackOf(userId) {
  const { rows } = await q(
    "SELECT id, scope, rating, body, created_at FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 50",
    [userId]
  );
  return rows;
}

export async function addEvent(userId, type, payload) {
  await q("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)", [
    userId || null,
    type,
    payload ? JSON.stringify(payload) : null,
    Date.now(),
  ]);
}

export async function listAllFeedback(limit) {
  const { rows } = await q(
    "SELECT f.id, f.scope, f.rating, f.body, f.created_at, u.email FROM feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT ?",
    [limit || 200]
  );
  return rows;
}

/* ── 汇总（只出数字，不出人） ── */
export async function stats() {
  const one = async (sql, ...args) => {
    const { rows } = await q(sql, args);
    return rows[0] ? Number(Object.values(rows[0])[0] || 0) : 0;
  };
  const since = Date.now() - 7 * DAY;
  return {
    users: await one("SELECT COUNT(*) AS n FROM users"),
    consented: await one("SELECT COUNT(*) AS n FROM users WHERE consented_at IS NOT NULL"),
    active7d: await one("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE created_at > ?", since),
    feedback: await one("SELECT COUNT(*) AS n FROM feedback"),
    events7d: await one("SELECT COUNT(*) AS n FROM events WHERE created_at > ?", since),
  };
}

/* ── 保留期：反馈与事件最多 12 个月，过期会话一并清掉 ── */
export async function purgeOld() {
  const cut = Date.now() - 365 * DAY;
  const f = await q("DELETE FROM feedback WHERE created_at < ?", [cut]);
  const e = await q("DELETE FROM events WHERE created_at < ?", [cut]);
  const s = await q("DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
  return {
    feedback: Number(f.changes || 0),
    events: Number(e.changes || 0),
    sessions: Number(s.changes || 0),
  };
}

/* ── 学习进度（跨设备同步；只存结构性进度，不存想法与笔记正文） ── */
export async function saveProgress(userId, data) {
  const now = Date.now();
  const text = JSON.stringify(data || {});
  const { rows } = await q("SELECT user_id FROM progress WHERE user_id = ?", [userId]);
  if (rows.length) {
    await q("UPDATE progress SET data = ?, updated_at = ? WHERE user_id = ?", [text, now, userId]);
  } else {
    await q("INSERT INTO progress (user_id, data, updated_at) VALUES (?,?,?)", [userId, text, now]);
  }
  return now;
}

export async function getProgress(userId) {
  const { rows } = await q("SELECT data, updated_at FROM progress WHERE user_id = ?", [userId]);
  const row = rows[0];
  if (!row) return { data: null, updated_at: 0 };
  let data = null;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = null;
  }
  return { data, updated_at: Number(row.updated_at) || 0 };
}

export async function dropProgress(userId) {
  await q("DELETE FROM progress WHERE user_id = ?", [userId]);
}
