/* 先见 · 接口冒烟测试（零依赖，Node 内置 node:test）
 *
 * 跑法：npm test   （或 node tools/test/api-smoke.mjs）
 *
 * 它会：
 *   1) 用 PORT=0 起一个临时实例，数据写到系统临时目录（XIANJIAN_DATA_DIR），
 *      不碰 大报告/服务/data/app.db，也不碰线上 D1；
 *   2) 验证健康检查、注册、未同意时拒绝、同意后写入、删号这条主链路；
 *   3) 不访问 B 站（不调用 /api/search），断网也能过。
 *
 * 注意：只测接口与静态文件，不测前端界面。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER = path.join(ROOT, "大报告", "服务", "server.mjs");

let child = null;
let base = "";
let dataDir = "";
let cookie = ""; // 只保存 xj_sid 的值

/* ── 启动临时实例，从 stdout 里读实际端口 ── */
function startServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("服务 20 秒内没起来")), 20_000);
    child = spawn(process.execPath, [SERVER], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        XIANJIAN_DATA_DIR: dataDir,
        // 确保测试不会误连线上 D1
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        D1_DATABASE_ID: "",
        BILI_COOKIE: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (s) => (out += s));
    child.stdout.on("data", (s) => {
      out += s;
      const m = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out);
      if (m && !base) {
        clearTimeout(timer);
        base = "http://127.0.0.1:" + m[1];
        resolve();
      }
    });
    child.on("exit", (code) => {
      if (!base) {
        clearTimeout(timer);
        reject(new Error("服务提前退出（" + code + "）：\n" + out));
      }
    });
  });
}

/* ── 带 cookie 的请求封装 ── */
async function api(pathname, { method = "GET", body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = "xj_sid=" + cookie;
  if (body !== undefined) headers["content-type"] = "application/json";

  const r = await fetch(base + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  for (const raw of r.headers.getSetCookie ? r.headers.getSetCookie() : []) {
    const m = /^xj_sid=([^;]*)/.exec(raw);
    if (m) cookie = m[1] ? decodeURIComponent(m[1]) : "";
  }

  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: r.status, body: parsed, contentType: r.headers.get("content-type") || "" };
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "xianjian-test-"));
  await startServer();
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((r) => child.once("exit", r));
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

test("静态首页能打开", async () => {
  const r = await api("/index.html");
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/html/);
});

test("/api/health 返回 ok 与同意版本", async () => {
  const r = await api("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(r.body.consent, "应带 consent 版本号");
  assert.equal(r.body.db, "sqlite");
});

test("未登录时 /api/me 返回空用户", async () => {
  const r = await api("/api/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.user, null);
});

test("注册 → 未同意被拒 → 同意后写入 → 删号", async () => {
  const email = "smoke-" + Date.now() + "@example.com";
  const password = "test-password-123";

  // 1) 注册（先不勾同意）
  const reg = await api("/api/register", {
    method: "POST",
    body: { email, password, consented: false },
  });
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  assert.equal(reg.body.user.consented, false);
  assert.ok(cookie, "注册后应拿到会话 cookie");

  // 2) 未同意：发反馈必须被 403 拒绝
  const denied = await api("/api/feedback", {
    method: "POST",
    body: { scope: "smoke", rating: 5, body: "这条不该被保存" },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.ok, false);

  // 3) 勾选同意
  const consent = await api("/api/consent", {
    method: "POST",
    body: { consented: true },
  });
  assert.equal(consent.status, 200);
  assert.equal(consent.body.consented, true);

  // 4) 同意后：反馈可写入
  const created = await api("/api/feedback", {
    method: "POST",
    body: { scope: "smoke", rating: 5, body: "冒烟测试反馈" },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.ok(created.body.id > 0);

  // 5) 能读回自己的反馈
  const list = await api("/api/feedback");
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].body, "冒烟测试反馈");

  // 6) 登录（同一个账号）
  cookie = "";
  const login = await api("/api/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.consented, true);

  // 7) 删号后会话失效、账号不存在
  const del = await api("/api/me", { method: "DELETE" });
  assert.equal(del.status, 200);
  const after = await api("/api/me");
  assert.equal(after.body.user, null);

  cookie = "";
  const again = await api("/api/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(again.status, 401, "删号后应登录失败");
});
