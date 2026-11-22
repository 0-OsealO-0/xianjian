/* 先见 · Cloudflare Worker 版 API
   把 大报告/服务/api.mjs + server.mjs 的接口搬到 fetch 运行时。

   与本地版的差异（都在这里写明，避免以后误判）：
   1) 密码哈希：Workers 没有 scrypt，改用 PBKDF2-SHA256（210000 次）；字段仍是 salt / hash。
   2) B 站 wbi 签名需要 md5，WebCrypto 不提供，自带 md5.js。
   3) 限流是「每 isolate 内存」，不是全局；免费额度下够用，真要严格再上 Durable Object。
   4) 管理端只认 ADMIN_TOKEN（Workers 没有"本机访问"这回事）。
*/

import { md5 } from "./md5.js";

const CONSENT_VERSION = "2026-11-22.v1";
const COOKIE = "xj_sid";
const DAY = 86400000;
const MAX_BODY = 64 * 1024;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      try {
        return await api(request, env, url);
      } catch (e) {
        return json(400, { ok: false, reason: String((e && e.message) || e) });
      }
    }
    return env.ASSETS.fetch(request);
  },
};

/* ── 基础 ── */
const json = (code, obj, extra) =>
  new Response(JSON.stringify(obj), {
    status: code,
    headers: Object.assign(
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      extra || {}
    ),
  });

const now = () => Date.now();

function cookieOf(request) {
  const out = {};
  (request.headers.get("cookie") || "").split(";").forEach((s) => {
    const i = s.indexOf("=");
    if (i > 0) out[s.slice(0, i).trim()] = decodeURIComponent(s.slice(i + 1).trim());
  });
  return out;
}

const sessionCookie = (token) =>
  COOKIE + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=" + 30 * 24 * 3600;
const clearCookie = () => COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0";

async function body(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error("body too large");
  if (!raw) return {};
  return JSON.parse(raw);
}

/* 限流：同 IP 每分钟 20 次写操作 */
const hits = new Map();
function limited(request) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const t = now();
  const h = hits.get(ip) || { n: 0, at: t };
  if (t - h.at > 60000) { h.n = 0; h.at = t; }
  h.n += 1;
  hits.set(ip, h);
  return h.n > 20;
}

/* ── 密码：PBKDF2-SHA256 ── */
const ITER = 210000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derive(password, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: ITER },
    key,
    256
  );
  return hex(bits);
}

const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));

/* ── 会话 ── */
const newToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function userOf(request, env) {
  const token = cookieOf(request)[COOKIE];
  if (!token) return { token: null, user: null };
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.consented_at, u.created_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first();
  if (!row || row.expires_at < now()) return { token, user: null };
  return { token, user: row };
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;

async function stats(env) {
  const one = async (sql, ...args) => {
    const r = await env.DB.prepare(sql).bind(...args).first();
    return (r && Object.values(r)[0]) || 0;
  };
  const since = now() - 7 * DAY;
  return {
    users: await one("SELECT COUNT(*) AS n FROM users"),
    consented: await one("SELECT COUNT(*) AS n FROM users WHERE consented_at IS NOT NULL"),
    active7d: await one("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE created_at > ?", since),
    feedback: await one("SELECT COUNT(*) AS n FROM feedback"),
    events7d: await one("SELECT COUNT(*) AS n FROM events WHERE created_at > ?", since),
  };
}

/* ── B 站：wbi 签名 + 搜索 ── */
const MIXIN = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21,
  56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

let wbiCache = { at: 0, img: "", sub: "" };
const biliCache = new Map(); // kw -> {at, items}

async function wbiKeys() {
  if (wbiCache.img && now() - wbiCache.at < 6 * 3600e3) return wbiCache;
  const r = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://www.bilibili.com/" },
  });
  const d = await r.json();
  const img = (d.data && d.data.wbi_img && d.data.wbi_img.img_url) || "";
  const sub = (d.data && d.data.wbi_img && d.data.wbi_img.sub_url) || "";
  const name = (u) => (u ? u.split("/").pop().split(".")[0] : "");
  wbiCache = { at: now(), img: name(img), sub: name(sub) };
  return wbiCache;
}

function signWbi(params, imgKey, subKey) {
  const key = (imgKey + subKey);
  const mixinKey = MIXIN.map((i) => key[i]).join("").slice(0, 32);
  const wts = Math.floor(now() / 1000);
  const all = Object.assign({}, params, { wts });
  const query = Object.keys(all).sort().map((k) => {
    const v = String(all[k]).replace(/[!'()*]/g, "");
    return encodeURIComponent(k) + "=" + encodeURIComponent(v);
  }).join("&");
  return query + "&w_rid=" + md5(query + mixinKey);
}

async function searchBili(kw) {
  const hit = biliCache.get(kw);
  if (hit && now() - hit.at < 24 * 3600e3) return hit.items;
  const { img, sub } = await wbiKeys();
  if (!img || !sub) return [];
  const qs = signWbi({ search_type: "video", keyword: kw, page_size: 8, order: "click" }, img, sub);
  const r = await fetch("https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs, {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://www.bilibili.com/" },
  });
  const d = await r.json();
  if (d.code !== 0) return [];
  const items = ((d.data && d.data.result) || []).filter((x) => x.bvid).map((x) => ({
    bvid: x.bvid,
    title: String(x.title || "").replace(/<[^>]+>/g, ""),
    author: x.author || "",
    duration: x.duration || "",
    play: x.play || 0,
    url: "https://www.bilibili.com/video/" + x.bvid,
    desc: String(x.description || "").slice(0, 60),
  }));
  biliCache.set(kw, { at: now(), items });
  return items;
}

/* ── 主路由 ── */
async function api(request, env, url) {
  const p = url.pathname;
  const m = request.method;
  const req = request;

  if (p === "/api/health") {
    const { img } = await wbiKeys().catch(() => ({ img: "" }));
    return json(200, { ok: true, consent: CONSENT_VERSION, db: true, cookie: !!img });
  }

  if (p === "/api/search") {
    const kw = (url.searchParams.get("kw") || "").trim();
    if (!kw) return json(400, { ok: false, reason: "缺少 kw", items: [] });
    const items = await searchBili(kw).catch(() => []);
    if (!items.length) return json(200, { ok: false, reason: "bili 没给结果", items: [] });
    return json(200, { ok: true, kw, items });
  }

  if (p === "/api/stats") return json(200, Object.assign({ ok: true, consent: CONSENT_VERSION }, await stats(env)));

  if (p === "/api/me" && m === "GET") {
    const { user } = await userOf(req, env);
    if (!user) return json(200, { ok: true, user: null });
    await env.DB.prepare("UPDATE users SET last_seen = ? WHERE id = ?").bind(now(), user.id).run();
    return json(200, { ok: true, user: { email: user.email, consented: !!user.consented_at, created_at: user.created_at } });
  }

  if (p === "/api/register" && m === "POST") {
    if (limited(req)) return json(429, { ok: false, reason: "太频繁了，等一分钟再试" });
    const { email, password, consented } = await body(req);
    const mail = String(email || "").trim().toLowerCase();
    if (!isEmail(mail)) return json(400, { ok: false, reason: "邮箱格式不对" });
    if (String(password || "").length < 8) return json(400, { ok: false, reason: "密码至少 8 位" });
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(mail).first();
    if (exists) return json(409, { ok: false, reason: "这个邮箱已经注册过了" });

    const salt = newSalt();
    const hash = await derive(String(password), salt);
    const r = await env.DB.prepare(
      "INSERT INTO users (email, salt, hash, consented_at, consent_ver, created_at) VALUES (?,?,?,?,?,?)"
    ).bind(mail, salt, hash, consented ? now() : null, consented ? CONSENT_VERSION : null, now()).run();
    const id = r.meta.last_row_id;
    const token = newToken();
    await env.DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)")
      .bind(token, id, now(), now() + 30 * DAY).run();
    await env.DB.prepare("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)")
      .bind(id, "register", JSON.stringify({ consented: !!consented }), now()).run();
    return json(200, { ok: true, user: { email: mail, consented: !!consented } }, { "set-cookie": sessionCookie(token) });
  }

  if (p === "/api/login" && m === "POST") {
    if (limited(req)) return json(429, { ok: false, reason: "太频繁了，等一分钟再试" });
    const { email, password } = await body(req);
    const mail = String(email || "").trim().toLowerCase();
    const row = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(mail).first();
    const okPw = row ? (await derive(String(password || ""), row.salt)) === row.hash : false;
    if (!row || !okPw) return json(401, { ok: false, reason: "邮箱或密码不对" });
    const token = newToken();
    await env.DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)")
      .bind(token, row.id, now(), now() + 30 * DAY).run();
    await env.DB.prepare("UPDATE users SET last_seen = ? WHERE id = ?").bind(now(), row.id).run();
    await env.DB.prepare("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)")
      .bind(row.id, "login", "{}", now()).run();
    return json(200, { ok: true, user: { email: row.email, consented: !!row.consented_at } }, { "set-cookie": sessionCookie(token) });
  }

  if (p === "/api/logout" && m === "POST") {
    const { token } = await userOf(req, env);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return json(200, { ok: true }, { "set-cookie": clearCookie() });
  }

  if (p === "/api/consent" && m === "POST") {
    const { user } = await userOf(req, env);
    if (!user) return json(401, { ok: false, reason: "先登录" });
    const { consented } = await body(req);
    await env.DB.prepare("UPDATE users SET consented_at = ?, consent_ver = ? WHERE id = ?")
      .bind(consented ? now() : null, consented ? CONSENT_VERSION : null, user.id).run();
    await env.DB.prepare("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)")
      .bind(user.id, "consent", JSON.stringify({ consented: !!consented }), now()).run();
    return json(200, { ok: true, consented: !!consented });
  }

  if (p === "/api/feedback" && m === "POST") {
    const { user } = await userOf(req, env);
    if (!user) return json(401, { ok: false, reason: "先登录再留反馈" });
    if (!user.consented_at) return json(403, { ok: false, reason: "需要先勾选同意，我才能保存这条反馈" });
    const { scope, rating, body: text0 } = await body(req);
    const text = String(text0 || "").trim();
    if (text.length < 2) return json(400, { ok: false, reason: "写一句也行" });
    if (text.length > 2000) return json(400, { ok: false, reason: "太长了，2000 字以内" });
    const rn = Number(rating);
    const rate = rn >= 1 && rn <= 5 ? Math.round(rn) : null;
    const r = await env.DB.prepare(
      "INSERT INTO feedback (user_id, scope, rating, body, contact, created_at) VALUES (?,?,?,?,?,?)"
    ).bind(user.id, String(scope || "").slice(0, 120), rate, text, null, now()).run();
    await env.DB.prepare("INSERT INTO events (user_id, type, payload, created_at) VALUES (?,?,?,?)")
      .bind(user.id, "feedback", JSON.stringify({ id: r.meta.last_row_id }), now()).run();
    return json(200, { ok: true, id: r.meta.last_row_id });
  }

  if (p === "/api/feedback" && m === "GET") {
    const { user } = await userOf(req, env);
    if (!user) return json(401, { ok: false, reason: "先登录" });
    const rows = await env.DB.prepare(
      "SELECT id, scope, rating, body, created_at FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 100"
    ).bind(user.id).all();
    return json(200, { ok: true, items: rows.results || [] });
  }

  if (p === "/api/me" && m === "DELETE") {
    const { user, token } = await userOf(req, env);
    if (!user) return json(401, { ok: false, reason: "先登录" });
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    await env.DB.prepare("DELETE FROM feedback WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM events WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
    return json(200, { ok: true }, { "set-cookie": clearCookie() });
  }

  if (p.startsWith("/api/admin/")) {
    const want = (env.ADMIN_TOKEN || "").trim();
    const given = req.headers.get("x-admin-token") || url.searchParams.get("token") || "";
    if (!want || given !== want) return json(401, { ok: false, reason: "需要管理员令牌" });
    if (p === "/api/admin/feedback") {
      const rows = (await env.DB.prepare(
        "SELECT f.id, f.scope, f.rating, f.body, f.created_at, u.email FROM feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT 200"
      ).all()).results || [];
      if ((url.searchParams.get("format") || "") === "csv") {
        const head = "id,created_at,email,scope,rating,body\n";
        const csv = head + rows.map((r) =>
          [r.id, new Date(r.created_at).toISOString(), r.email || "", r.scope || "", r.rating == null ? "" : r.rating,
           '"' + String(r.body).replace(/"/g, '""') + '"'].join(",")).join("\n");
        return new Response("\ufeff" + csv, {
          headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="feedback.csv"' },
        });
      }
      return json(200, { ok: true, items: rows, stats: await stats(env) });
    }
    return json(404, { ok: false, reason: "没有这个接口" });
  }

  return json(404, { ok: false, reason: "没有这个接口" });
}
