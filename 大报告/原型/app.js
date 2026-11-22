/* 先见 · 交互 v0.2
   一次只给一件事：画像 → 挑一条路 → 目标 → 当前这一件 → 做完被追问 → 下一件。 */

const KEY = "xianjian.v3.state";
const OLD_KEY = "xianjian.v2.state";
const view = document.getElementById("view");
const rail = document.getElementById("rail");

const DEFAULT = {
  screen: "landing",
  saves: [],
  activeSave: null,
  profile: { school: "东南大学", major: "ee", grade: "大一", hours: "4-6", interest: "" },
  units: {},
  dir: null,
  done: [],
  answers: [],
  achieved: [],
  evidence: {},
  mine: [],
  vidRes: null,
  idea: "",
  versions: [],
  last: null,
  model: { base: "", key: "", name: "" },
};

let S = load();

/* 本机服务探测：只有通过 http(s) 打开、且 /api/health 通，才启用「就地搜」 */
const NET = { ok: false, checked: false };
async function checkNet() {
  NET.checked = true;
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    const j = await r.json();
    NET.ok = !!(j && j.ok);
  } catch (e) { NET.ok = false; }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
    const s = JSON.parse(raw);
    return Object.assign(JSON.parse(JSON.stringify(DEFAULT)), s);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT));
  }
}
function save() {
  try {
    saveCurrent();
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
  try {
    if (window.XJ_ACCOUNT && window.XJ_ACCOUNT.onLocalChange) window.XJ_ACCOUNT.onLocalChange();
  } catch (e) {}
}

/* ───────── 存档：一个人可以有多条并行的进度 ─────────
   平铺字段（profile/units/dir/done/...）始终是「当前存档」；
   S.saves 存其它存档的快照，切换时先 saveCurrent() 再 applySnap()。
*/
function snapNow() {
  return {
    profile: JSON.parse(JSON.stringify(S.profile)),
    units: JSON.parse(JSON.stringify(S.units)),
    dir: S.dir,
    done: (S.done || []).slice(),
    achieved: (S.achieved || []).slice(),
    evidence: JSON.parse(JSON.stringify(S.evidence || {})),
    mine: (S.mine || []).slice(),
    idea: S.idea || "",
    versions: (S.versions || []).slice(),
  };
}

function applySnap(x) {
  if (!x) return;
  if (x.profile) S.profile = Object.assign({}, S.profile, x.profile);
  S.units = x.units || {};
  S.dir = x.dir || null;
  S.done = (x.done || []).slice();
  S.achieved = (x.achieved || []).slice();
  S.evidence = x.evidence || {};
  S.mine = (x.mine || []).slice();
  S.idea = x.idea || "";
  S.versions = (x.versions || []).slice();
  S.answers = [];
  S.vidRes = null;
  S.last = null;
}

function saveCurrent() {
  if (!S.saves || !S.activeSave) return;
  const e = S.saves.filter(function (x) { return x.id === S.activeSave; })[0];
  if (e) { e.snap = snapNow(); e.at = Date.now(); }
}

function ensureSaves() {
  if (!Array.isArray(S.saves)) S.saves = [];
  if (!S.saves.length) {
    const id = "s" + Date.now().toString(36);
    S.saves = [{ id: id, name: "第一条路", at: Date.now(), snap: snapNow() }];
    S.activeSave = id;
    return;
  }
  const has = S.saves.filter(function (x) { return x.id === S.activeSave; })[0];
  if (!has) S.activeSave = S.saves[0].id;
}

function activeSave() {
  ensureSaves();
  return S.saves.filter(function (x) { return x.id === S.activeSave; })[0] || S.saves[0];
}

function newSave(name) {
  saveCurrent();
  const id = "s" + Date.now().toString(36);
  S.saves.push({
    id: id,
    name: name || "存档 " + (S.saves.length + 1),
    at: Date.now(),
    snap: { profile: JSON.parse(JSON.stringify(S.profile)), units: {}, dir: null, done: [], achieved: [], evidence: {}, mine: [], idea: "", versions: [] },
  });
  S.activeSave = id;
  applySnap(S.saves[S.saves.length - 1].snap);
  S.screen = "hello";
  save();
}

function useSave(id) {
  if (id === S.activeSave) return;
  saveCurrent();
  const t = S.saves.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  S.activeSave = id;
  applySnap(t.snap);
  S.screen = t.snap && t.snap.dir ? "map" : "hello";
  save();
}

function renameSave(id, name) {
  const t = S.saves.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  t.name = name || t.name;
  t.at = Date.now();
  save();
}

function delSave(id) {
  if (S.saves.length <= 1) return false;
  S.saves = S.saves.filter(function (x) { return x.id !== id; });
  if (S.activeSave === id) {
    S.activeSave = S.saves[0].id;
    applySnap(S.saves[0].snap);
  }
  save();
  return true;
}

/* ───────── 任务链 ───────── */

const learned = (u) => S.units[u] === "done";

function queue(dirId) {
  const d = DIR_BY_ID[dirId];
  if (!d) return [];
  const out = [];
  const added = {};
  d.steps.forEach((st, i) => {
    (st.req || []).forEach((u) => {
      if (!learned(u) && !added[u]) { added[u] = 1; out.push(learnTask(u)); }
    });
    out.push({
      key: "step:" + d.id + ":" + i,
      k: st.k,
      t: st.t,
      min: st.min,
      why: st.why,
      how: st.how,
      ask: st.ask || null,
      idx: i,
      of: d.steps.length,
    });
  });
  return out;
}

function currentTask() {
  const q = queue(S.dir);
  return q.find((t) => S.done.indexOf(t.key) < 0) || null;
}

function progressOf() {
  const q = queue(S.dir);
  const inQ = {};
  q.forEach((t) => { inQ[t.key] = 1; });
  const extra = S.done.filter((k) => !inQ[k]).length;
  const done = q.filter((t) => S.done.indexOf(t.key) >= 0).length + extra;
  return { done, all: q.length + extra, q };
}

function completeTask(t) {
  if (S.done.indexOf(t.key) < 0) S.done.push(t.key);
  if (t.k === "learn") {
    S.units[t.unit] = "done";
    S.achieved.unshift({ t: "补上了「" + (UNITS[t.unit] || {}).name + "」", when: Date.now() });
  } else {
    S.achieved.unshift({ t: t.t, when: Date.now() });
  }
  save();
}

/* ───────── 渲染外壳 ───────── */

let vtBusy = false;

function paint(scroll) {
  const html = render();
  const swap = () => { view.innerHTML = html; syncRail(); };
  const after = () => {
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
    save();
  };
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !vtBusy && !reduce) {
    vtBusy = true;
    try {
      const t = document.startViewTransition(swap);
      const done = () => { vtBusy = false; };
      if (t && t.finished && t.finished.then) t.finished.then(done, done);
      else done();
    } catch (e) {
      vtBusy = false;
      swap();
    }
  } else {
    swap();
  }
  after();
}

function syncUserbox() {
  const box = document.getElementById("userbox");
  if (!box) return;
  const me = (window.XJ_ACCOUNT && XJ_ACCOUNT.me) || null;
  box.innerHTML = me
    ? '<div class="uline"><span class="dot-on"></span><b title="' + me.email + '">' + me.email.split("@")[0] + "</b></div>"
      + '<button class="btn small wide" data-act="toAccount">账号与反馈</button>'
    : '<button class="btn small wide primary" data-act="toAccount">登录 / 注册</button>'
      + '<p>登录后进度可跨设备</p>';
}

function syncRail() {
  syncUserbox();
  if (rail) rail.classList.toggle("min", S.screen === "landing" || S.screen === "about");
  const p = S.dir ? progressOf() : null;
  const items = [
    { n: 1, t: "看看这个专业", s: "先看见方向" },
    { n: 2, t: "你现在到哪了", s: "学过什么，差在哪" },
    { n: 3, t: "手头这一件事", s: p ? p.done + "/" + p.all + " 件" : "做完再说下一步" },
  ];
  rail.querySelector(".steps").innerHTML = items.map((it, i) => {
    const active = ["hello", "intro", "about", "map"].indexOf(S.screen) >= 0 ? i === 0
      : S.screen === "know" ? i === 1 : i === 2;
    return '<li><button class="' + (active ? "on" : "") + '" data-act="nav" data-n="' + it.n + '">'
      + '<span class="num">' + it.n + '</span><span class="label">' + it.t + '</span></button></li>';
  }).join("");
}

function render() {
  switch (S.screen) {
    case "landing": return screenLanding();
    case "hello": return screenHello();
    case "intro": return screenIntro();
    case "about": return screenAbout();
    case "know": return screenKnow();
    case "map": return screenMap();
    case "goal": return screenGoal();
    case "task": return screenTask();
    case "check": return screenCheck();
    case "feedback": return screenFeedback();
    case "finished": return screenFinished();
    case "progress": return screenProgress();
    default: return screenHello();
  }
}

/* ───────── 1. 开场 ───────── */


/* ───────── 0. 卷首页 ───────── */

function screenLanding() {
  const me = (window.XJ_ACCOUNT && XJ_ACCOUNT.me) || null;
  const A = window.AUTHOR || { name: "先见", role: "", email: "", repo: "" };
  return '<div class="hero">'
    + '<p class="kicker">东南大学 · 《人工智能通识导论》创意作品</p>'
    + '<h1 class="hero-h1">先见</h1>'
    + '<p class="hero-sub">先看清这个专业在忙什么，再决定学什么。</p>'
    + '<p class="hero-lede">大多数人走的是「基础课 → 专业课 → 实习 → 出路」，到大三才第一次看清自己能做什么。'
    + '这里把顺序倒过来：先给你一张方向地图，再给你一件现在就能做的事，缺什么就补什么。</p>'
    + '<div class="hero-cta">'
    + (me
      ? '<button class="btn primary lg" data-act="toHello">继续 · ' + me.email.split("@")[0] + " →</button>"
      + '<button class="btn lg" data-act="toAccount">账号与反馈</button>'
      : '<button class="btn primary lg" data-act="toAccount">登录 / 注册</button>'
      + '<button class="btn lg" data-act="toHello">先随便看看 →</button>')
    + "</div>"
    + '<p class="small muted">' + (me ? "已登录，进度会跟着账号走，换设备接着做。" : "不登录也能用，进度只存在这台电脑上；登录后才能跨设备接上。") + "</p>"
    + "</div>"
    + '<div class="hero-grid">'
    + '<div class="card soft"><div class="ctitle">① 先看见方向</div><p class="small">六条工程方向，每条都从「一件现在就能做的事」开始——不是职业清单，是愿意先撞上去的问题。</p></div>'
    + '<div class="card soft"><div class="ctitle">② 一次只给一件事</div><p class="small">不给你一张八周表格。做完这一件，我再告诉你下一件；缺的地基会当场插进来。</p></div>'
    + '<div class="card soft"><div class="ctitle">③ 做完被追问</div><p class="small">「为什么成立、哪里可能是错的」——答不上来的地方，就是下一次要补的那一块。</p></div>'
    + "</div>"
    + '<footer class="sitefoot">'
    + '<div><b>' + A.name + "</b>" + (A.role ? " · " + A.role : "") + "</div>"
    + '<div>' + (A.email ? '联系：<a href="mailto:' + A.email + '">' + A.email + "</a>" : "") + "</div>"
    + '<div class="links">'
    + '<a href="plan.html" target="_blank" rel="noopener">完整企划书 ↗</a>'
    + '<a data-act="toAbout">它为什么长这样</a>'
    + (A.repo ? '<a href="' + A.repo + '" target="_blank" rel="noopener">源代码（GitHub）↗</a>' : "")
    + "</div>"
    + '<p class="small muted">这是课程作品，还在试用期：数据只在你和这台服务器之间；不收集浏览记录与学习内容正文。</p>'
    + "</footer>";
}

function screenHello() {
  const p = S.profile;
  const m = MAJOR_BY_ID[p.major] || MAJOR_LIST[0];
  return '<div class="wrap narrow">'
    + '<p class="kicker">开始之前</p>'
    + '<h1 class="big">先看清楚这个专业在忙什么，<br>再决定学什么。</h1>'
    + '<p class="lede">大多数人是「基础课 → 专业课 → 实习 → 出路」，走到大三才第一次看清这个专业能做什么。'
    + '这里把顺序倒过来：先让你看见方向，再给你一件事做，缺什么补什么。</p>'
    + '<div class="card">'
    + '<div class="row"><label>你在哪所学校</label><select class="sel" data-act="school">'
    + SCHOOLS.map((s) => '<option value="' + s.name + '"' + (p.school === s.name ? " selected" : "") + ">" + s.name + "</option>").join("")
    + '</select><span class="hint">课程表按东南大学的培养方案整理；换学校先沿用同一份专业地图</span></div>'
    + '<div class="row"><label>你的专业</label><select class="sel" data-act="major">'
    + MAJOR_LIST.map((x) => '<option value="' + x.id + '"' + (p.major === x.id ? " selected" : "") + ">" + x.name + "</option>").join("")
    + '</select><span class="hint">' + m.pos + '</span></div>'
    + '<div class="row"><label>你现在</label><div class="picks" data-act="grade">'
    + ["大一", "大二", "大三", "大四"].map((g) =>
      '<button class="pick ' + (p.grade === g ? "on" : "") + '" data-act="grade" data-v="' + g + '">' + g + "</button>").join("")
    + '</div></div>'
    + '<div class="row"><label>每周能拿出</label><div class="picks" data-act="hours">'
    + ["2-3", "4-6", "8+", "说不准"].map((h) =>
      '<button class="pick ' + (p.hours === h ? "on" : "") + '" data-act="hours" data-v="' + h + '">' + (h === "说不准" ? h : h + " 小时") + "</button>").join("")
    + '</div></div>'
    + '</div>'
    + '<div class="foot"><button class="btn primary" data-act="toIntro">先看看这个专业 →</button>'
    + '<button class="btn ghost" data-act="toAbout">这份东西为什么长这样</button>'
    + '<span class="muted small">不用注册，数据只存在这台电脑上</span></div>'
    + "</div>";
}

/* ───────── 1.5 专业介绍：先给地图，再问选哪条 ───────── */

function screenIntro() {
  const m = MAJOR_BY_ID[S.profile.major] || MAJOR_LIST[0];
  return '<div class="wrap">'
    + '<p class="kicker">' + m.name + '</p>'
    + '<h1 class="big">这个专业在解决的，是这类问题。</h1>'
    + '<p class="lede">' + m.pos + "</p>"
    + '<div class="grid2">'
    + '<div class="card soft"><div class="ctitle">它在啃的三类硬问题</div><ul class="tight">'
    + m.questions.map((q) => "<li>" + q + "</li>").join("") + "</ul></div>"
    + '<div class="card soft"><div class="ctitle">走出校门后，长成的样子</div><ul class="tight">'
    + m.future.map((f) => "<li>" + f + "</li>").join("") + "</ul></div>"
    + '</div>'
    + '<div class="callout"><b>一个常见误解：</b>' + m.myth + "</div>"
    + langPathBlock()
    + '<div class="card">'
    + '<div class="ctitle">你也可以带着自己的问题来</div>'
    + '<p class="small muted">不必先选方向。把你现在想解的一个问题写下来（一句也行）——走完一条路之后，我们回来一起改它。</p>'
    + '<textarea class="input area" id="idea" placeholder="例如：我想知道为什么手机信号满格还是很慢">' + esc(S.idea) + "</textarea>"
    + '</div>'
    + '<div class="foot"><button class="btn" data-act="backHello">上一步</button>'
    + '<button class="btn primary" data-act="toMap">看看有哪些方向 →</button></div>'
    + "</div>";
}

/* 去哪学：给搜索深链，不给死链接 */
function aiTeacherPrompt(t) {
  const done = Object.keys(S.units).filter((u) => S.units[u] === "done").map((u) => UNITS[u] && UNITS[u].name).filter(Boolean).slice(0, 8);
  return [
    "你是我的老师，不是替我写作业的人。",
    "",
    "我现在的这一步是：" + t.t,
    "它的要求是：" + (t.how || []).map((h, i) => "(" + (i + 1) + ") " + h).join(" ") ,
    "我已经学过的内容：" + (done.length ? done.join("、") : "几乎没有，请按零基础讲"),
    "",
    "请用我 15 分钟能读完的方式回答，四段就够：",
    "1) 这一步到底要做什么，用一句话说清；",
    "2) 我需要的最小前置知识（只讲够用的那一点，不要铺开）；",
    "3) 给我一个能直接跑起来 / 直接动手的最小例子，并告诉我跑完应该看到什么；",
    "4) 问我三个能检验我是否真懂的问题（先别给答案）。",
    "",
    "规则：不要一次给一大段理论；讲完让我自己动手；如果我的理解有错，直接指出错在哪一句。",
  ].join("\n");
}


function vidResBlock(kw) {
  const v = S.vidRes;
  if (!v || v.kw !== kw) return "";
  if (v.loading) return '<div class="vidres"><p class="small muted">在搜…</p></div>';
  if (!v.ok) return '<div class="vidres"><p class="small muted">没搜到（' + (v.reason || "接口不可用") + '）。就用上面的搜索入口吧。</p></div>';
  if (!v.items || !v.items.length) return '<div class="vidres"><p class="small muted">这个词在 B 站没有像样的结果，换个说法试试。</p></div>';
  return '<div class="vidres">' + v.items.slice(0, 3).map(function (it) {
    return '<div class="vitem"><a href="' + it.url + '" target="_blank" rel="noopener">' + it.title + '</a>'
      + '<span class="vmeta">' + it.author + " · " + it.duration + " · "
      + (it.play >= 10000 ? (Math.round(it.play / 1000) / 10) + " 万播放" : it.play + " 播放") + "</span>"
      + '<button class="btn tiny" data-act="saveVid" data-bvid="' + it.bvid + '">收进我的清单</button></div>';
  }).join("") + "</div>";
}

function resBlock(t) {
  const r = resFor(t);
  const link = (href, label) => '<a class="reslink" href="' + href + '" target="_blank" rel="noopener">' + label + ' ↗</a>';
  const courses = t.unit ? coursesFor(t.unit) : [];
  const courseHtml = courses.map((c) =>
    '<div class="cr"><a class="crtitle" href="' + c.url + '" target="_blank" rel="noopener">' + c.title + '</a>'
    + '<span class="crumb">' + c.by + (c.kind === "search" ? " · 需自己挑一个" : "") + "</span>"
    + (c.note ? '<span class="crnote">' + c.note + "</span>" : "") + "</div>").join("");
  return '<div class="card"><p class="muted small">去哪学（这一步的）</p>'
    + (courseHtml ? '<div class="courses"><p class="small muted" style="margin:0 0 2px">人工筛过的</p>' + courseHtml + "</div>" : "")
    + '<div class="resrow"><span class="rk">看视频</span>'
    + link(r.bili, "B 站搜「" + r.kw + "」（按播放量排）")
    + link(r.mooc, "中国大学 MOOC 搜「" + r.kw + "」") + "</div>"
    + (r.doc ? '<div class="resrow"><span class="rk">读文档</span>' + link(r.doc.url, r.doc.name) + "</div>" : "")
    + (r.gh ? '<div class="resrow"><span class="rk">抄代码</span>' + link(r.gh, "GitHub 上找 " + r.repo) + "</div>" : "")
    + '<div class="resrow"><span class="rk">就地搜</span>'
    + (NET.ok
      ? '<button class="btn small" data-act="findVid" data-kw="' + r.kw.replace(/"/g, "&quot;") + '">在 B 站找 3 个候选</button>'
        + '<span class="small muted">不用跳走，直接看标题 / 时长 / 播放量</span>'
      : '<span class="small muted">要就地搜，用本机服务打开：<code>node 服务/server.mjs</code>，再访问 http://127.0.0.1:8787/</span>')
    + "</div>"
    + vidResBlock(r.kw)
    + '<div class="resrow airow"><span class="rk">找老师</span>'
    + '<button class="btn small" data-act="aiTeacher">让 AI 讲这一节</button>'
    + '<span class="small muted">会给你一段可以直接粘进 ChatGPT / DeepSeek 的提示词（含你的进度）</span></div>'
    + (S.aiOpen ? aiPanel(t) : "")
    + "</div>";
}

function aiPanel(t) {
  const p = aiTeacherPrompt(t);
  return '<div class="aibox"><p class="small muted">把它粘进任何模型都行。它已经写清了你的这一步、你要动手做的事、以及你已学过的内容。</p>'
    + '<textarea class="ta" readonly rows="8" id="aitext">' + p.replace(/</g, "&lt;") + "</textarea>"
    + '<div class="foot"><button class="btn small primary" data-act="copyAI">复制这段提示词</button>'
    + '<button class="btn small" data-act="closeAI">收起</button></div></div>';
}

/* 语言路线：不是一张表，是排好序的一条线 */
function langPathBlock() {
  const path = LANG_PATHS[S.profile.major] || LANG_PATHS.ee;
  return '<div class="card">'
    + '<div class="ctitle">这个专业的编程语言路线</div>'
    + '<p class="small muted" style="margin-top:0">顺序不是随便排的：先有「把算法写成步骤」的能力，再谈脚本、对象和仿真。'
    + '这些课都在第 2 步的知识点列表里，学过哪块就勾哪块——勾过的，后面的任务会自动跳过它。</p>'
    + '<ol class="langpath">'
    + path.map((l) => {
      const c = langCourseOf(l.lid);
      const total = c ? c.units.length : 0;
      const done = c ? c.units.filter((u) => S.units[u.id] === "done").length : 0;
      return '<li class="lang' + (done === total && total ? " ok" : "") + '">'
        + '<div class="lhead"><b>' + l.name + '</b><span class="lwhen">' + l.when + "</span>"
        + (total ? '<span class="lprog">' + done + "/" + total + " 块</span>" : "") + "</div>"
        + '<p class="lwhy">' + l.why + "</p>"
        + '<p class="lfirst"><span class="muted">第一件：</span>' + l.first + "</p>"
        + "</li>";
    }).join("")
    + "</ol></div>";
}

/* ───────── 关于：长文稿入口 ───────── */

function screenAbout() {
  return '<div class="wrap">'
    + '<p class="kicker">关于这个产品</p>'
    + '<h1>它为什么长这样。</h1>'
    + '<p class="lede">一句话：把「基础课 → 专业课 → 实习 → 出路」这条路径倒过来——先让你看见方向，再让一个问题把知识拖出来。</p>'
    + '<div class="card">'
    + '<div class="ctitle">四个不妥协的地方</div>'
    + '<ol class="tight">'
    + '<li><b>先给地图，不给答案。</b>方向比知识点先出现，因为不知道「要用它做什么」时，知识记不住。</li>'
    + '<li><b>一次只给一件事。</b>不把整个计划一次摊开，只给你现在能做完的那一件。</li>'
    + '<li><b>审查看过程，不看产出。</b>做完之后追问「为什么成立、哪里可能是错的」，答不上来的地方就是下次要补的地基。</li>'
    + '<li><b>交付的是诊断，不是分数。</b>这里没有正确率，只有「你现在缺哪一块」。</li>'
    + '</ol></div>'
    + '<div class="callout">完整的设想、风险、以及它凭什么是现在——都写在企划书里。</div>'
    + '<div class="foot"><a class="btn primary" href="plan.html" target="_blank" rel="noopener">打开完整企划书 ↗</a>'
    + '<button class="btn" data-act="backFromAbout">返回</button></div>'
    + "</div>";
}

/* ───────── 2. 学过什么 ───────── */

function screenKnow() {
  const totalDone = Object.keys(S.units).filter((u) => S.units[u] === "done").length;
  const totalDoing = Object.keys(S.units).filter((u) => S.units[u] === "doing").length;
  return '<div class="wrap">'
    + '<p class="kicker">第 2 步 · 你现在的进度</p>'
    + '<h1>你现在学到哪了？</h1>'
    + '<p class="lede">' + (S.dir ? '你选了「' + DIR_BY_ID[S.dir].name + '」。走这条路之前，先告诉我你学到哪了——差在哪，计划就补在哪。' : '不用勾整门课。高数修了一半就勾一半的知识点——差在哪，后面就补在哪。')
    + '已经学过 <b id="kcount">' + totalDone + '</b> 个知识点，在学 <b id="kdoing">' + totalDoing + " 个。</p>"
    + '<p class="legend">标记方法：每个知识点右边有一个按钮——<b>点一下 = 在学</b>，<b>再点一下 = 已学</b>，<b>第三下 = 清空</b>。'
    + "不用勾整门课，勾到你觉得「这块我大概会了」的那一层就行。</p>"
    + '<div class="courses">' + coursesOf(S.profile.major).map(courseBlock).join("") + '</div>'
    + '<div class="foot"><button class="btn" data-act="backHello">上一步</button>'
    + '<button class="btn primary" data-act="' + (S.dir ? "toGoal" : "toMap") + '">' + (S.dir ? "看我的计划" : "看看有哪些方向") + "</button></div>"
    + '</div>';
}

function courseBlock(c) {
  const d = c.units.filter((u) => S.units[u.id] === "done").length;
  const g = c.units.filter((u) => S.units[u.id] === "doing").length;
  const open = c.id === (window.__openCourse || "");
  return '<div class="course' + (open ? " open" : "") + '" data-course="' + c.id + '">'
    + '<button class="chead" data-act="fold" data-c="' + c.id + '">'
    + '<span class="cname">' + c.name + '</span>'
    + '<span class="cwhen">' + c.when + "</span>"
    + '<span class="csum">' + (d ? "学过 " + d : g ? "在学 " + g : "还没开始") + (d && g ? " · 在学 " + g : "") + "</span>"
    + '<span class="arrow">›</span></button>'
    + '<div class="clist">' + c.units.map(unitRow).join("") + '</div>'
    + '</div>';
}

function unitRow(u) {
  const st = S.units[u.id] || "";
  const label = st === "done" ? "学过" : st === "doing" ? "在学" : "没学";
  return '<div class="unit">'
    + '<span class="uname">' + u.name + '</span>'
    + '<button class="tstate ' + st + '" data-act="unit" data-u="' + u.id + '" title="点一下=在学，再点一下=已学，第三下=清空">' + label + "</button>"
    + "</div>";
}

/* ───────── 3. 方向地图 ───────── */

function screenMap() {
  return '<div class="wrap">'
    + '<p class="kicker">第 1 步 · 这个专业在忙什么</p>'
    + '<h1>这个专业有 ' + dirsOf(S.profile.major).length + ' 条路，先挑一条走。</h1>'
    + '<p class="lede">每条路都从「一件现在就能做的事」开始，不需要先修。挑一条，走完再换也不亏。</p>'
    + '<div class="dirs">' + dirsOf(S.profile.major).map(dirCard).join("") + '</div>'
    + (S.profile.major === "cross" ? "" :
      '<div class="matrix cross"><h2 class="mini">如果你对其他专业的方向也感兴趣</h2>'
      + '<p class="small muted">这四条是跨学科的路，任何专业都能走；选一条，课程表会跟着换成对应专业的地基。</p>'
      + '<div class="dirs xdirs">' + CROSS_DIRECTIONS.map(dirCard).join("") + '</div></div>')
    + '<div class="matrix">'
    + '<h2 class="mini">如果你也想过「矩阵到底用来干什么」</h2>'
    + '<div class="mcards">' + MATRIX_HOOKS.map((m) =>
      '<details class="mcard"><summary>' + m.head + "</summary><p>" + m.body + '</p><p class="muted">' + m.shows + "</p></details>").join("") + "</div>"
    + '</div>'
    + '<div class="foot"><button class="btn" data-act="toKnow">回去改进度</button>'
    + '<button class="btn ghost" data-act="toAbout">这份东西为什么长这样</button></div>'
    + '</div>';
}

function dirCard(d) {
  const need = [];
  d.steps.forEach((s) => (s.req || []).forEach((u) => { if (!learned(u)) need.push(UNITS[u].name); }));
  const uniq = need.filter((v, i) => need.indexOf(v) === i);
  return '<button class="dir" data-act="pick" data-d="' + d.id + '" style="--ac:' + d.accent + '">'
    + '<span class="dtag">' + d.tag + "</span>"
    + '<span class="dname">' + d.name + "</span>"
    + '<span class="dteaser">' + d.teaser + "</span>"
    + '<span class="dneed">' + (uniq.length ? "会用到：" + uniq.join("、") : "不需要先修") + "</span>"
    + '<span class="dgo">选这条 ›</span>'
    + "</button>";
}

/* ───────── 4. 目标 ───────── */

function estimate() {
  const q = queue(S.dir);
  const mins = q.reduce((s, t) => s + (t.min || 30), 0);
  const h = S.profile.hours === "2-3" ? 2.5 : S.profile.hours === "4-6" ? 5 : S.profile.hours === "8+" ? 8 : 3;
  const days = Math.max(q.length, Math.ceil(mins / (h * 60)));
  return { mins, days, perDay: Math.max(15, Math.round(mins / days)) };
}

function screenGoal() {
  const d = DIR_BY_ID[S.dir];
  const p = progressOf();
  const first = currentTask();
  const e = estimate();
  return '<div class="wrap narrow">'
    + '<p class="kicker">第 3 步 · 你的计划：' + d.name + '</p>'
    + '<h1>' + d.goal + '</h1>'
    + '<div class="card soft">'
    + '<div class="goalrow"><span class="muted">一共</span><b>' + p.all + " 件</b>"
    + '<span class="muted">· 按你每周 ' + S.profile.hours + ' 小时，大约 ' + e.days + ' 天</span></div>'
    + '<div class="dots">' + p.q.map(() => '<i></i>').join("") + "</div>"
    + '<p class="small muted">一天一件就够（每件 20–60 分钟）。做完一件，我再告诉你下一件。</p>'
    + (S.idea ? '<p class="small muted" style="margin-top:10px">你带来的问题：' + esc(S.idea) + '——走完这条路，我们回来改它。</p>' : "")
    + '</div>'
    + '<div class="card">'
    + '<p class="muted small">第一件</p>'
    + '<p class="ftitle">' + (first ? first.t : "—") + "</p>"
    + '<p class="small">' + (first ? first.why : "") + "</p>"
    + '</div>'
    + '<div class="foot"><button class="btn" data-act="toMap">换一条</button>'
    + '<button class="btn primary" data-act="toTask">开始第一件</button></div>'
    + '</div>';
}

/* ───────── 5. 当前这一件事 ───────── */

function screenTask() {
  const t = currentTask();
  if (!t) { S.screen = "finished"; return screenFinished(); }
  const p = progressOf();
  const n = p.done + 1;
  return '<div class="wrap narrow">'
    + '<div class="taskhead"><span class="kicker">第 ' + n + " 件 · 共 " + p.all + " 件</span>"
    + '<div class="dots">' + p.q.map((x, i) =>
      '<i class="' + (S.done.indexOf(x.key) >= 0 ? "on" : i === p.done ? "cur" : "") + '"></i>').join("") + "</div></div>"
    + '<h1>' + t.t + "</h1>"
    + '<p class="lede">' + t.why + "</p>"
    + '<div class="card">'
    + '<p class="muted small">怎么做' + (t.k === "learn" ? "（大概 " + t.min + " 分钟）" : "") + "</p>"
    + '<ol class="how">' + t.how.map((h) => "<li>" + h + "</li>").join("") + "</ol>"
    + (t.from ? '<p class="small muted">来自：' + t.from + "</p>" : "")
    + '</div>'
    + resBlock(t)
    + ((t.k === "do" || t.k === "learn")
      ? '<div class="card soft"><p class="muted small">留痕（可以不写）</p>'
        + '<p class="small muted" style="margin:4px 0 8px">写过的几行代码、跑出来的数字、你在截图里看到的东西——一句话也行。它不打分，只是让你下次翻回来知道做到哪了。</p>'
        + '<textarea id="ev" class="ta" placeholder="例如：误码率在 SNR=8dB 时约 1e-2，和书上那张图对得上">'
        + ((S.evidence && S.evidence[t.key]) ? S.evidence[t.key].text : "") + '</textarea></div>'
      : "")
    + '<div class="foot"><button class="btn primary" data-act="did">我做完了</button>'
    + '<button class="btn" data-act="stuck">我卡住了</button></div>'
    + (S.stuck ? '<div class="card soft"><p class="small"><b>卡住很正常。</b>你可以先把这一步的最小版本做出来——'
      + '哪怕只画出两个点、只看见一次闪烁，也算数。实在做不动，就跳过它，我在后面会知道。</p>'
      + '<div class="foot"><button class="btn" data-act="skip">先跳过这件</button></div></div>' : "")
    + '</div>';
}

/* ───────── 6. 被追问 ───────── */

function screenCheck() {
  const t = currentTask();
  if (!t || !t.ask) { S.screen = "task"; return screenTask(); }
  return '<div class="wrap narrow">'
    + '<p class="kicker">做完了，先别急着往下走</p>'
    + '<h1 class="q">' + t.ask.q + "</h1>"
    + '<p class="lede small">想到多少写多少，一句话也行。写得糙没关系，我要看的是你怎么想的。</p>'
    + '<textarea class="input area" id="ans" placeholder="我看到的 / 我的解释是……"></textarea>'
    + '<div class="foot"><button class="btn" data-act="backTask">回去再看一眼</button>'
    + '<button class="btn primary" data-act="submit">提交</button></div>'
    + '</div>';
}

/* ───────── 7. 反馈 ───────── */

function screenFeedback() {
  const L = S.last || {};
  const t = L.task;
  const j = L.judge || { level: "mid", hits: [], miss: [] };
  const next = currentTask();
  const p = progressOf();
  const tone = !t.ask ? "完成了" : j.level === "good" ? "接住了" : j.level === "mid" ? "碰到边了" : "这次没对上";
  const cls = j.level === "good" ? "good" : j.level === "mid" ? "mid" : "low";
  return '<div class="wrap narrow">'
    + '<div class="fb ' + cls + '">'
    + '<span class="fbtag">' + tone + "</span>"
    + (!t.ask
      ? '<p class="fbtext">这一步你做完了。不用回头检查，往下走。</p>'
      : j.level === "good"
        ? '<p class="fbtext">' + t.ask.follow + "</p>"
        : j.level === "mid"
          ? '<p class="fbtext">你碰到了关键的那一层，但还差一点。' + t.ask.follow + "</p>"
          : '<p class="fbtext">没关系，这题本来就不容易。关键是：' + t.ask.follow + "</p>")
    + (j.miss && j.miss.length && j.level !== "good"
      ? '<p class="small muted">这个话题里值得再想一想的：' + j.miss.slice(0, 4).join("、") + "</p>" : "")
    + "</div>"
    + '<div class="ach">'
    + '<p class="kicker">你刚刚拿到了</p>'
    + '<p class="achname">' + (t.k === "learn" ? (UNITS[t.unit] || {}).name : t.t) + "</p>"
    + '<div class="bar"><i style="width:' + Math.round((p.done / p.all) * 100) + '%"></i></div>'
    + '<p class="small muted">第 ' + p.done + " / " + p.all + " 件完成</p>"
    + "</div>"
    + (next
      ? '<div class="card"><p class="muted small">下一件</p><p class="ftitle">' + next.t + "</p>"
        + '<p class="small muted">' + next.min + " 分钟 · 现在就可以开始</p></div>"
      : '<div class="card soft"><p class="ftitle">这条路的东西你走完了。</p>'
        + '<p class="small">你已经能：' + (DIR_BY_ID[S.dir] || {}).unlock + "</p></div>")
    + '<div class="foot">'
    + (next ? '<button class="btn primary" data-act="toTask">开始下一件</button>'
      : '<button class="btn primary" data-act="toFinished">看总结</button>')
    + '<button class="btn" data-act="toProgress">我的进度</button></div>'
    + "</div>";
}

/* ───────── 8. 走完 ───────── */

function screenFinished() {
  const d = DIR_BY_ID[S.dir] || {};
  const p = progressOf();
  return '<div class="wrap narrow">'
    + '<p class="kicker">走完了一条路</p>'
    + '<h1>' + d.name + "，你已经走完一遍。</h1>"
    + '<p class="lede">' + (d.unlock || "") + "</p>"
    + (Object.keys(S.evidence || {}).length
      ? '<p class="small muted">你在这条路上留下了 ' + Object.keys(S.evidence).length + ' 条痕迹，都在「我的进度」里。</p>' : "")
    + '<div class="card"><p class="muted small">这一趟你做的事</p><ul class="done">'
    + listedTasks().map((t) => '<li class="' + (S.done.indexOf(t.key) >= 0 ? "ok" : "") + '">' + t.t + "</li>").join("")
    + "</ul></div>"
    + ideaBlock()
    + '<div class="foot"><button class="btn primary" data-act="toMap">换一条路</button>'
    + '<button class="btn" data-act="toProgress">我的进度</button></div>'
    + "</div>";
}

/* 走完一条路之后，回到你带来的那个问题 */
function ideaBlock() {
  if (!S.idea) {
    return '<div class="card soft"><div class="ctitle">你带来的问题</div>'
      + '<p class="small muted">这次你没写自己的问题。下次可以带着一个来——走完一条路之后，我们再回来改它。</p></div>';
  }
  const vs = S.versions || [];
  const head = '<div class="ctitle">你带来的问题 · ' + (vs.length ? "已改 " + vs.length + " 版" : "第 1 版") + "</div>";
  if (S.showIdeaEdit) {
    return '<div class="card soft">' + head
      + '<textarea class="input area" id="ideanew">' + esc(S.idea) + "</textarea>"
      + '<div class="foot" style="margin-top:0"><button class="btn primary" data-act="saveIdea">保存这一版</button>'
      + '<button class="btn" data-act="cancelIdea">先不改</button></div></div>';
  }
  return '<div class="card soft">' + head
    + '<p class="idea">' + esc(S.idea) + "</p>"
    + (vs.length ? '<p class="small muted">上一版：' + esc(vs[vs.length - 1]) + "</p>" : "")
    + '<div class="foot" style="margin-top:12px"><button class="btn" data-act="reviseIdea">走完这一趟，它该改哪里？</button></div>'
    + "</div>";
}

/* ───────── 9. 进度 ───────── */

function listedTasks() {
  const q = queue(S.dir);
  const inQ = {};
  q.forEach((t) => { inQ[t.key] = 1; });
  const extra = S.done.filter((k) => !inQ[k]).map((k) =>
    k.indexOf("learn:") === 0 ? learnTask(k.slice(6)) : { key: k, t: k });
  return q.concat(extra);
}


function savesBlock() {
  ensureSaves();
  const rows = S.saves.map(function (x) {
    const on = x.id === S.activeSave;
    const d = (x.snap && x.snap.done) || [];
    const dirName = (x.snap && x.snap.dir && DIR_BY_ID[x.snap.dir]) ? DIR_BY_ID[x.snap.dir].name : "还没选方向";
    return '<li class="' + (on ? "on" : "") + '">'
      + '<div class="sv-main"><b>' + x.name + "</b><span>" + dirName + " · 完成 " + d.length + " 件</span></div>"
      + '<div class="sv-act">'
      + (on ? '<span class="pill on">当前</span>'
        : '<button class="btn tiny" data-act="useSave" data-id="' + x.id + '">切换到这个</button>')
      + '<button class="btn tiny ghost" data-act="renameSave" data-id="' + x.id + '">改名</button>'
      + (S.saves.length > 1 ? '<button class="btn tiny ghost" data-act="delSave" data-id="' + x.id + '">删除</button>' : "")
      + "</div></li>";
  }).join("");
  return '<div class="card"><p class="muted small">我的存档（' + S.saves.length + "）</p>"
    + '<p class="small">想重来一次、或者试另一条路？新建一个存档，两条进度互不干扰，随时切回来。</p>'
    + '<ul class="saves">' + rows + "</ul>"
    + '<div class="foot tight"><button class="btn primary" data-act="newSave">新建一个存档</button>'
    + '<span class="small muted">存档会跟着账号同步（未登录时只在本机）</span></div></div>';
}

function screenProgress() {
  const d = S.dir ? DIR_BY_ID[S.dir] : null;
  const p = S.dir ? progressOf() : { done: 0, all: 0, q: [] };
  const items = S.dir ? listedTasks() : [];
  return '<div class="wrap narrow">'
    + '<p class="kicker">我的进度</p>'
    + '<h1>' + (d ? d.name : "还没选方向") + "</h1>"
    + (d ? '<div class="card"><div class="goalrow"><span class="muted">已完成</span><b>' + p.done + " / " + p.all + "</b></div>"
      + '<div class="bar"><i style="width:' + Math.round((p.done / p.all) * 100) + '%"></i></div>'
      + '<ul class="done">' + items.map((t) => '<li class="' + (S.done.indexOf(t.key) >= 0 ? "ok" : "") + '">'
        + t.t + "</li>").join("") + "</ul></div>" : "")
    + savesBlock()
    + '<div class="card"><p class="muted small">你补上/完成过的</p>'
    + (S.achieved.length
      ? '<ul class="achlist">' + S.achieved.slice(0, 12).map((a) => "<li>" + a.t + "</li>").join("") + "</ul>"
      : '<p class="small muted">还没有。去做第一件事。</p>')
    + "</div>"
    + '<div class="card"><p class="muted small">你留下的痕迹</p>'
    + (Object.keys(S.evidence || {}).length
      ? '<ul class="evlist">' + Object.keys(S.evidence).map((k) => {
          const t = items.filter((x) => x.key === k)[0];
          const e = S.evidence[k];
          return "<li><b>" + (t ? t.t : k) + "</b><span>"
            + e.text.replace(/[<>]/g, "").slice(0, 120) + "</span></li>";
        }).join("") + "</ul>"
      : '<p class="small muted">还没有。做动手的那几件时，随手写一句就会存在这里。</p>')
    + "</div>"
    + '<div class="card"><p class="muted small">我收下的课</p>'
    + ((S.mine || []).length
      ? '<ul class="minelist">' + S.mine.map(function (m) {
          return '<li><a href="' + m.url + '" target="_blank" rel="noopener">' + m.title + '</a>'
            + '<span class="vmeta">' + m.author + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="small muted">还没有。任务页「就地搜」出来的候选，点「收进我的清单」就会存到这里。</p>')
    + '</div>'
    + '<div class="card"><p class="muted small">知识进度</p>'
    + '<div class="ksum">' + Object.keys(S.units).filter((u) => S.units[u] === "done").length + " 个知识点标记为学过 · "
    + Object.keys(S.units).filter((u) => S.units[u] === "doing").length + " 个在学"
    + ' <button class="btn small" data-act="toKnow">去改</button></div></div>'
    + '<div class="foot">'
    + (d ? '<button class="btn primary" data-act="toTask">回到手头这一件</button>' : "")
    + '<button class="btn" data-act="toMap">换一条路</button>'
    + '<button class="btn" data-act="export">导出我的记录</button>'
    + '<button class="btn ghost" data-act="reset">清空重来</button></div>'
    + "</div>";
}

/* ───────── 事件 ───────── */

document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;

  /* 小选择器就地更新，不重绘整页（避免闪） */
  if (act === "grade" || act === "hours") {
    const v = b.dataset.v;
    if (act === "grade") S.profile.grade = v; else S.profile.hours = v;
    b.parentNode.querySelectorAll(".pick").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    save();
    return;
  }

  if (act === "unit") {
    const u = b.dataset.u;
    const cur = S.units[u] || "";
    const next = cur === "" ? "doing" : cur === "doing" ? "done" : "";
    if (next) S.units[u] = next; else delete S.units[u];
    b.className = "tstate " + next;
    b.textContent = next === "done" ? "学过" : next === "doing" ? "在学" : "没学";
    const card = b.closest(".course");
    const cid = card.dataset.course;
    const c = coursesOf(S.profile.major).find((x) => x.id === cid);
    const d = c.units.filter((x) => S.units[x.id] === "done").length;
    const g = c.units.filter((x) => S.units[x.id] === "doing").length;
    card.querySelector(".csum").textContent = (d ? "学过 " + d : g ? "在学 " + g : "还没开始") + (d && g ? " · 在学 " + g : "");
    const kc = document.getElementById("kcount");
    const kd = document.getElementById("kdoing");
    if (kc) kc.textContent = Object.keys(S.units).filter((x) => S.units[x] === "done").length;
    if (kd) kd.textContent = Object.keys(S.units).filter((x) => S.units[x] === "doing").length;
    save();
    return;
  }

  if (act === "fold") {
    const id = b.dataset.c;
    const card = b.closest(".course");
    const open = card.classList.toggle("open");
    window.__openCourse = open ? id : "";
    return;
  }

  switch (act) {
    case "toHello":
    case "startNow": {
      S.screen = "hello";
      save();
      paint(true);
      return;
    }
    case "toLanding": {
      S.screen = "landing";
      save();
      paint(true);
      return;
    }
    case "newSave": {
      const name = (window.prompt("给这个存档起个名字（可留空）") || "").trim();
      newSave(name);
      paint(false);
      return;
    }
    case "useSave": {
      useSave(b.dataset.id);
      paint(false);
      return;
    }
    case "renameSave": {
      const t = S.saves.filter(function (x) { return x.id === b.dataset.id; })[0];
      const name = (window.prompt("新名字", t ? t.name : "") || "").trim();
      if (name) { renameSave(b.dataset.id, name); paint(false); }
      return;
    }
    case "delSave": {
      if (!window.confirm("删除这个存档？里面的进度会一起没。")) return;
      delSave(b.dataset.id);
      paint(false);
      return;
    }
    case "toIntro": {
      const it = document.getElementById("interest");
      if (it) S.profile.interest = it.value;
      S.screen = "intro"; paint(true); break;
    }
    case "toAbout":
      S.screen = "about"; paint(true); break;
    case "backFromAbout":
      S.screen = S.dir ? "goal" : S.knowDone ? "know" : "hello"; paint(true); break;
    case "toKnow": {
      const it = document.getElementById("interest");
      if (it) S.profile.interest = it.value;
      S.knowDone = true;
      S.screen = "know"; paint(true); break;
    }
    case "backHello":
      S.screen = "hello"; paint(true); break;
    case "toMap": {
      const ideaEl = document.getElementById("idea");
      if (ideaEl) S.idea = ideaEl.value;
      S.screen = "map"; paint(true); break;
    }
    case "pick":
      S.dir = b.dataset.d; S.last = null;
      S.screen = S.knowDone ? "goal" : "know";
      paint(true); break;
    case "toGoal":
      S.knowDone = true; S.screen = "goal"; paint(true); break;
    case "toTask":
      S.screen = "task"; S.stuck = false; paint(true); break;
    case "did":
      afterTask(); break;
    case "findVid": {
      const kw = b.dataset.kw || "";
      S.vidRes = { kw: kw, loading: true };
      paint(false);
checkNet().then(function () { if (NET.ok) paint(false); });
      try {
        const r = await fetch("/api/search?kw=" + encodeURIComponent(kw));
        S.vidRes = Object.assign({ kw: kw }, await r.json());
      } catch (e) {
        S.vidRes = { kw: kw, ok: false, reason: "请求失败", items: [] };
      }
      paint(false);
      break;
    }
    case "saveVid": {
      const v = S.vidRes;
      const it = v && v.items ? v.items.filter(function (x) { return x.bvid === b.dataset.bvid; })[0] : null;
      if (it && !(S.mine || []).some(function (x) { return x.bvid === it.bvid; })) {
        S.mine = S.mine || [];
        S.mine.push({ bvid: it.bvid, title: it.title, author: it.author, url: it.url });
        save();
      }
      b.textContent = "已收 ✓";
      break;
    }
    case "aiTeacher":
      S.aiOpen = true; paint(false); break;
    case "closeAI":
      S.aiOpen = false; paint(false); break;
    case "copyAI": {
      const el = document.getElementById("aitext");
      if (el) {
        el.select();
        try { document.execCommand("copy"); } catch (e) {}
        b.textContent = "已复制 ✓";
      }
      break;
    }
    case "stuck":
      S.stuck = true; paint(false); break;
    case "skip":
      completeTask(currentTask());
      S.last = { task: currentTask() || { t: "", ask: null }, judge: { level: "mid", hits: [], miss: [] } };
      S.screen = "feedback"; S.stuck = false; paint(false); break;
    case "backTask":
      S.screen = "task"; paint(false); break;
    case "submit":
      submitAnswer(); break;
    case "reviseIdea":
      S.showIdeaEdit = true; paint(false); break;
    case "cancelIdea":
      S.showIdeaEdit = false; paint(false); break;
    case "saveIdea": {
      const el = document.getElementById("ideanew");
      const v = el ? el.value.trim() : "";
      if (v) {
        S.versions = S.versions || [];
        S.versions.push(S.idea);
        S.idea = v;
      }
      S.showIdeaEdit = false; save(); paint(false); break;
    }
    case "toFinished":
      S.screen = "finished"; paint(true); break;
    case "toProgress":
      S.screen = "progress"; paint(true); break;
    case "nav": {
      const n = +b.dataset.n;
      if (n === 1) S.screen = S.dir ? "map" : "intro";
      else if (n === 2) S.screen = "know";
      else S.screen = S.dir ? (currentTask() ? "task" : "finished") : "intro";
      paint(true); break;
    }
    case "export": {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "先见-我的记录.json";
      a.click();
      break;
    }
    case "reset":
      if (confirm("清空这台电脑上的记录？")) { localStorage.removeItem(KEY); S = JSON.parse(JSON.stringify(DEFAULT)); paint(true); }
      break;
  }
});

/* 下拉选择（学校 / 专业） */
document.addEventListener("change", (ev) => {
  const el = ev.target.closest("select[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "school") {
    S.profile.school = el.value;
    save();
    return;
  }
  if (act === "major") {
    S.profile.major = el.value;
    const d = S.dir && DIR_BY_ID[S.dir];
    const keep = d && (CROSS_DIRECTIONS.indexOf(d) >= 0 || dirsOf(el.value).some((x) => x.id === d.id));
    if (!keep) { S.dir = null; S.last = null; }
    save();
    paint(false);
  }
});

/* 输入框回车也能提交 */
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && S.screen === "check") submitAnswer();
});

function saveEvidence(t) {
  const el = document.getElementById("ev");
  const v = el ? el.value.trim() : "";
  if (!v) return;
  S.evidence = S.evidence || {};
  S.evidence[t.key] = { text: v, at: Date.now() };
}

function afterTask() {
  const t = currentTask();
  if (t) saveEvidence(t);
  if (!t) { S.screen = "finished"; return paint(true); }
  if (t.ask) {
    S.screen = "check";
    paint(false);
    setTimeout(() => {
      const ta = document.getElementById("ans");
      if (ta) ta.focus();
    }, 80);
    return;
  }
  completeTask(t);
  S.last = { task: t, judge: { level: "good", hits: [], miss: [] } };
  S.screen = "feedback";
  paint(false);
}

function submitAnswer() {
  const t = currentTask();
  const ta = document.getElementById("ans");
  const text = ta ? ta.value : "";
  const j = judge(t.ask, text);
  S.answers.push({ q: t.ask.q, a: text, level: j.level });
  completeTask(t);
  S.last = { task: t, judge: j };
  S.screen = "feedback";
  paint(false);
}

/* ───────── 小工具 ───────── */

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* 启动 */
if (S.screen === "task" || S.screen === "check" || S.screen === "feedback") {
  if (!S.dir || !currentTask()) S.screen = S.dir ? "finished" : "map";
}
paint(false);
checkNet().then(function () { if (NET.ok) paint(false); });

/* ───────── 跨设备同步：只同步结构性进度 ─────────
   同步：完成到哪些任务、知识点标过什么、拿到哪些成就、专业/方向/年级/每周时长
   不同步：你写的想法、留痕正文、答题原文（这些只在本机）
*/
const UNIT_RANK = { doing: 1, done: 2 };

function syncSnapshot() {
  return {
    v: 2,
    at: Date.now(),
    profile: {
      school: S.profile.school,
      major: S.profile.major,
      grade: S.profile.grade,
      hours: S.profile.hours,
    },
    dir: S.dir || null,
    units: Object.assign({}, S.units),
    saves: JSON.parse(JSON.stringify(S.saves || [])),
    activeSave: S.activeSave,
    done: S.done.slice(),
    achieved: (S.achieved || []).map(function (a) {
      return { key: a.key || a.t, t: a.t, at: a.at };
    }),
  };
}

function syncMerge(remote) {
  if (!remote || typeof remote !== "object") return { added: 0 };
  let added = 0;

  const units = remote.units || {};
  Object.keys(units).forEach(function (k) {
    const r = UNIT_RANK[units[k]] || 0;
    const l = UNIT_RANK[S.units[k]] || 0;
    if (r > l) {
      S.units[k] = units[k];
      added += 1;
    }
  });

  (remote.done || []).forEach(function (k) {
    if (typeof k === "string" && S.done.indexOf(k) < 0) {
      S.done.push(k);
      added += 1;
    }
  });

  const have = {};
  (S.achieved || []).forEach(function (a) {
    if (a) have[a.key || a.t] = 1;
  });
  (remote.achieved || []).forEach(function (a) {
    const k = a && (a.key || a.t);
    if (k && !have[k]) {
      S.achieved.push(a);
      have[k] = 1;
      added += 1;
    }
  });

  // 存档：按 id 并集；同 id 取「完成件数更多」的那份，避免远端把本地清掉
  if (Array.isArray(remote.saves) && remote.saves.length) {
    if (!Array.isArray(S.saves)) S.saves = [];
    remote.saves.forEach(function (rs) {
      const mine = S.saves.filter(function (x) { return x.id === rs.id; })[0];
      if (!mine) { S.saves.push(rs); added += 1; }
      else {
        const a = (mine.snap && mine.snap.done ? mine.snap.done.length : 0);
        const b = (rs.snap && rs.snap.done ? rs.snap.done.length : 0);
        if (b > a) { mine.snap = rs.snap; mine.name = rs.name || mine.name; added += 1; }
      }
    });
    if (remote.activeSave && S.saves.some(function (x) { return x.id === remote.activeSave; })) {
      if (!S.activeSave || S.activeSave === remote.activeSave) S.activeSave = remote.activeSave;
    }
  }

  if (!S.dir && remote.dir && DIR_BY_ID[remote.dir]) S.dir = remote.dir;
  if (remote.profile) {
    ["school", "major", "grade", "hours"].forEach(function (k) {
      if (!S.profile[k] && remote.profile[k]) S.profile[k] = remote.profile[k];
    });
  }

  save();
  return { added: added };
}

window.XJ_BRIDGE = {
  snapshot: syncSnapshot,
  merge: syncMerge,
  repaint: function () {
    paint(false);
  },
  screen: function () {
    return S.screen;
  },
};
