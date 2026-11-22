/* 先见 · 账号与反馈接口（零依赖）
   目的：让试用者能各自登录、留下反馈，并在**知情同意**的前提下记录最小必要的使用数据。

   接口：
     POST   /api/register   { email, password, consented }
     POST   /api/login      { email, password }
     POST   /api/logout
     GET    /api/me          → { email, consented, created_at }
     POST   /api/consent     { consented }
     POST   /api/feedback    { scope, rating, body }
     GET    /api/feedback    → 自己的反馈
     DELETE /api/me          → 删号并清空自己的数据
     GET    /api/stats       → 只有汇总数字（人数/同意数/反馈数/近 7 天事件数）

   没有存 IP、没有存 UA、没有第三方脚本。
*/

import {
  addEvent,
  addFeedback,
  createSession,
  createUser,
  deleteUser,
  dropSession,
  feedbackOf,
  listAllFeedback,
  findUserByEmail,
  setConsent,
  stats,
  touchUser,
  userBySession,
  usingD1,
} from "./store.mjs";

export const CONSENT_VERSION = "2026-11-22.v1";
const COOKIE = "xj_sid";
const MAX_BODY = 64 * 1024;

const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
};

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, req, token) {
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https");
  const parts = [
    COOKIE + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + 30 * 24 * 60 * 60,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("set-cookie", parts.join("; "));
}

function clearSession(res) {
  res.setHeader("set-cookie", COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

/* 极简限流：同一 IP 每分钟最多 20 次写操作 */
const hits = new Map();
function limited(req) {
  const ip = req.socket.remoteAddress || "?";
  const now = Date.now();
  const h = hits.get(ip) || { n: 0, at: now };
  if (now - h.at > 60_000) {
    h.n = 0;
    h.at = now;
  }
  h.n += 1;
  hits.set(ip, h);
  return h.n > 20;
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;

async function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  return { token, user: await userBySession(token) };
}

/* 返回 true 表示这个请求已被处理 */
export async function handleApi(req, res, url) {
    // /api/search 由 server.mjs 自己处理（B 站代理），这里放行
    if (url.pathname === "/api/search") return false;

  const p = url.pathname;
  if (!p.startsWith("/api/")) return false;

  try {
    /* ── 健康检查 ── */
    if (p === "/api/health") {
      json(res, 200, { ok: true, consent: CONSENT_VERSION, db: usingD1 ? "d1" : "sqlite" });
      return true;
    }

    /* ── 汇总数字（不含任何个人信息） ── */
    if (p === "/api/stats") {
      json(res, 200, Object.assign({ ok: true, consent: CONSENT_VERSION }, await stats()));
      return true;
    }

    /* ── 我 ── */
    if (p === "/api/me") {
      const { user } = await currentUser(req);
      if (!user) return json(res, 200, { ok: true, user: null }), true;
      await touchUser(user.id);
      json(res, 200, {
        ok: true,
        user: {
          email: user.email,
          consented: !!user.consented_at,
          created_at: user.created_at,
        },
      });
      return true;
    }

    if (req.method === "POST" && p === "/api/register") {
      if (limited(req)) return json(res, 429, { ok: false, reason: "太频繁了，等一分钟再试" }), true;
      const { email, password, consented } = await readBody(req);
      const mail = String(email || "").trim().toLowerCase();
      if (!isEmail(mail)) return json(res, 400, { ok: false, reason: "邮箱格式不对" }), true;
      if (String(password || "").length < 8)
        return json(res, 400, { ok: false, reason: "密码至少 8 位" }), true;
      if (await findUserByEmail(mail))
        return json(res, 409, { ok: false, reason: "这个邮箱已经注册过了" }), true;

      const id = await createUser(mail, String(password), !!consented, CONSENT_VERSION);
      const token = await createSession(id);
      setSession(res, req, token);
      await addEvent(id, "register", { consented: !!consented });
      json(res, 200, { ok: true, user: { email: mail, consented: !!consented } });
      return true;
    }

    if (req.method === "POST" && p === "/api/login") {
      if (limited(req)) return json(res, 429, { ok: false, reason: "太频繁了，等一分钟再试" }), true;
      const { email, password } = await readBody(req);
      const mail = String(email || "").trim().toLowerCase();
      const row = await findUserByEmail(mail);
      const { verifyPassword } = await import("./store.mjs");
      if (!row || !verifyPassword(String(password || ""), row.salt, row.hash))
        return json(res, 401, { ok: false, reason: "邮箱或密码不对" }), true;
      const token = await createSession(row.id);
      setSession(res, req, token);
      await touchUser(row.id);
      await addEvent(row.id, "login");
      json(res, 200, { ok: true, user: { email: row.email, consented: !!row.consented_at } });
      return true;
    }

    if (req.method === "POST" && p === "/api/logout") {
      const { token } = await currentUser(req);
      await dropSession(token);
      clearSession(res);
      json(res, 200, { ok: true });
      return true;
    }

    if (req.method === "POST" && p === "/api/consent") {
      const { user } = await currentUser(req);
      if (!user) return json(res, 401, { ok: false, reason: "先登录" }), true;
      const { consented } = await readBody(req);
      await setConsent(user.id, !!consented, CONSENT_VERSION);
      await addEvent(user.id, "consent", { consented: !!consented });
      json(res, 200, { ok: true, consented: !!consented });
      return true;
    }

    /* ── 反馈 ── */
    if (req.method === "POST" && p === "/api/feedback") {
      const { user } = await currentUser(req);
      if (!user) return json(res, 401, { ok: false, reason: "先登录再留反馈" }), true;
      if (!user.consented_at)
        return json(res, 403, { ok: false, reason: "需要先勾选同意，我才能保存这条反馈" }), true;
      const { scope, rating, body } = await readBody(req);
      const text = String(body || "").trim();
      if (text.length < 2) return json(res, 400, { ok: false, reason: "写一句也行" }), true;
      if (text.length > 2000) return json(res, 400, { ok: false, reason: "太长了，2000 字以内" }), true;
      const id = await addFeedback({
        userId: user.id,
        scope: String(scope || "").slice(0, 120),
        rating: (function (r) { return r >= 1 && r <= 5 ? Math.round(r) : null; })(Number(rating)),
        body: text,
      });
      await addEvent(user.id, "feedback", { id });
      json(res, 200, { ok: true, id });
      return true;
    }

    if (req.method === "GET" && p === "/api/feedback") {
      const { user } = await currentUser(req);
      if (!user) return json(res, 401, { ok: false, reason: "先登录" }), true;
      json(res, 200, { ok: true, items: await feedbackOf(user.id) });
      return true;
    }

    /* ── 删号 ── */
    if (req.method === "DELETE" && p === "/api/me") {
      const { user, token } = await currentUser(req);
      if (!user) return json(res, 401, { ok: false, reason: "先登录" }), true;
      await dropSession(token);
      await deleteUser(user.id);
      clearSession(res);
      json(res, 200, { ok: true });
      return true;
    }


    /* ── 管理端（只给开发者）：需要 ADMIN_TOKEN，或从本机访问 ── */
    if (p.startsWith("/api/admin/")) {
      const token = process.env.ADMIN_TOKEN || "";
      const given = req.headers["x-admin-token"] || url.searchParams.get("token") || "";
      const local = (req.socket.remoteAddress || "").includes("127.0.0.1") || (req.socket.remoteAddress || "").includes("::1");
      if (token ? given !== token : !local) {
        json(res, 401, { ok: false, reason: "需要管理员令牌" });
        return true;
      }
      if (p === "/api/admin/feedback") {
        const rows = await listAllFeedback(200);
        if ((url.searchParams.get("format") || "") === "csv") {
          const head = "id,created_at,email,scope,rating,body\n";
          const csv = head + rows.map((r) =>
            [r.id, new Date(r.created_at).toISOString(), r.email || "", r.scope || "", r.rating == null ? "" : r.rating,
             '"' + String(r.body).replace(/"/g, '""') + '"'].join(",")).join("\n");
          res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="feedback.csv"' });
          res.end("\ufeff" + csv);
          return true;
        }
        json(res, 200, { ok: true, items: rows, stats: await stats() });
        return true;
      }
      json(res, 404, { ok: false, reason: "没有这个接口" });
      return true;
    }
    json(res, 404, { ok: false, reason: "没有这个接口" });
    return true;
  } catch (e) {
    json(res, 400, { ok: false, reason: String(e && e.message ? e.message : e) });
    return true;
  }
}
