/* 先见 · 本地小后端（零依赖，Node 18+）
   作用有两个：
   1) 把 原型/ 目录用 http 服务起来（file:// 下拿不到跨域数据，也没法调本机接口）；
   2) 提供 /api/search?kw=... ，代理 B 站搜索，给「看视频」那一行返回 3 个候选。

   跑法：
     node 服务/server.mjs            # 默认 http://127.0.0.1:8787
     PORT=9000 node 服务/server.mjs

   说明：
   - 只监听 127.0.0.1，不对外网开放；
   - 不保存任何个人信息；搜索结果在内存里缓存 24 小时；
   - B 站有风控：没 cookie 时可能返回 -412。可以自己导出一份浏览器 cookie 放到环境变量：
       BILI_COOKIE="buvid3=...; b_nut=..." node 服务/server.mjs
   - 拿不到数据时接口返回 { ok:false, reason }，前端会退回「跳搜索页」，不会白屏。
*/

import http from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleApi } from "./api.mjs";
import { purgeOld } from "./store.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "原型");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const CACHE_MS = 24 * 60 * 60 * 1000;

/* ───────── B 站 wbi 签名 ───────── */
const MIXIN_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const mixinKey = (orig) => MIXIN_TAB.map((n) => orig[n]).join("").slice(0, 32);

function signWbi(params, imgKey, subKey) {
  const key = mixinKey(imgKey + subKey);
  const wts = Math.round(Date.now() / 1000);
  const all = Object.assign({}, params, { wts });
  const query = Object.keys(all)
    .sort()
    .map((k) => {
      const v = String(all[k]).replace(/[!'()*]/g, "");
      return encodeURIComponent(k) + "=" + encodeURIComponent(v);
    })
    .join("&");
  const w_rid = createHash("md5").update(query + key).digest("hex");
  return query + "&w_rid=" + w_rid;
}

/* ───────── 会话：cookie 与 wbi 密钥 ───────── */
let cookie = process.env.BILI_COOKIE || "";
let wbi = { imgKey: "", subKey: "", at: 0 };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function ensureCookie() {
  if (cookie) return cookie;
  const res = await fetch("https://www.bilibili.com/", {
    headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" },
    redirect: "follow",
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const pairs = setCookie.map((c) => c.split(";")[0]).filter(Boolean);
  const want = pairs.filter((p) => /^(buvid3|buvid4|b_nut|buvid_fp|_uuid)=/.test(p));
  cookie = want.join("; ");
  return cookie;
}

async function ensureWbi() {
  if (wbi.imgKey && Date.now() - wbi.at < 6 * 60 * 60 * 1000) return wbi;
  const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "user-agent": UA, cookie: await ensureCookie(), referer: "https://www.bilibili.com/" },
  });
  const j = await res.json();
  const img = j?.data?.wbi_img?.img_url || "";
  const sub = j?.data?.wbi_img?.sub_url || "";
  const pick = (u) => (u.split("/").pop() || "").split(".")[0];
  wbi = { imgKey: pick(img), subKey: pick(sub), at: Date.now() };
  return wbi;
}

/* ───────── 搜索（带缓存） ───────── */
const cache = new Map();
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();

async function searchBili(kw) {
  const hit = cache.get(kw);
  if (hit && Date.now() - hit.at < CACHE_MS) return Object.assign({ cached: true }, hit.data);

  const { imgKey, subKey } = await ensureWbi();
  const qs = signWbi(
    { search_type: "video", keyword: kw, page: 1, page_size: 8, order: "click" },
    imgKey,
    subKey
  );
  const url = "https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs;
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      cookie: await ensureCookie(),
      referer: "https://search.bilibili.com/",
      "accept-language": "zh-CN,zh;q=0.9",
    },
  });
  const j = await res.json();
  if (j.code !== 0) {
    return { ok: false, reason: "bili " + j.code + " " + (j.message || ""), items: [] };
  }
  const raw = (j.data && j.data.result) || [];
  const items = raw.slice(0, 5).map((v) => ({
    bvid: v.bvid,
    title: strip(v.title),
    author: v.author,
    duration: v.duration,
    play: v.play,
    url: "https://www.bilibili.com/video/" + v.bvid,
    desc: strip(v.description).slice(0, 60),
  }));
  const data = { ok: true, kw, order: "click", items };
  cache.set(kw, { at: Date.now(), data });
  return Object.assign({ cached: false }, data);
}

/* ───────── 静态文件 ───────── */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const abs = path.resolve(ROOT, "." + rel);
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const buf = await readFile(abs);
    res.writeHead(200, {
      "content-type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found: " + rel);
  }
}

/* ───────── 服务 ───────── */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  try {
    if (u.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, cookie: !!cookie, port: PORT }));
      return;
    }
    if (await handleApi(req, res, u)) return;
    if (u.pathname === "/api/search") {
      const kw = (u.searchParams.get("kw") || "").trim();
      if (!kw) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, reason: "kw required", items: [] }));
        return;
      }
      const data = await searchBili(kw);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
      return;
    }
    await serveStatic(req, res, u.pathname);
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, reason: String(e && e.message ? e.message : e), items: [] }));
  }
});

try {
  const r = purgeOld();
  if (r.feedback || r.events || r.sessions) console.log("保留期清理：", JSON.stringify(r));
} catch (e) { console.log("保留期清理跳过：", e.message); }

server.listen(PORT, HOST, () => {
  console.log("先见 本地服务已启动： http://127.0.0.1:" + PORT + "/");
  console.log("静态目录：" + ROOT);
  console.log("接口：/api/health  /api/search?kw=BPSK");
});
