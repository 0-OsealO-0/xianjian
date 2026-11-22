import io, re

# ---------- 1. index.html ----------
p = "index.html"
s = io.open(p, encoding="utf-8").read()
if 'id="userbox"' not in s:
    s = s.replace('    <div class="railfoot">',
                  '    <div class="userbox" id="userbox"></div>\n    <div class="railfoot">')
s = re.sub(r'\?v=\d+', '?v=300', s)
io.open(p, "w", encoding="utf-8").write(s)

# ---------- 2. app.js ----------
p = "app.js"
s = io.open(p, encoding="utf-8").read()

# 2.1 KEY + DEFAULT
s = s.replace('const KEY = "xianjian.v2.state";', 'const KEY = "xianjian.v3.state";\nconst OLD_KEY = "xianjian.v2.state";')
s = s.replace('''const DEFAULT = {
  screen: "hello",''', '''const DEFAULT = {
  screen: "landing",
  saves: [],
  activeSave: null,''')

# 2.2 load(): v3 优先，其次迁移 v2
s = s.replace('''function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT));''', '''function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT));''')

# 2.3 save(): 先把当前平铺状态写回当前存档
s = s.replace('''function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}''', '''function save() {
  try {
    saveCurrent();
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}''')

# 2.4 存档：snapshot / apply / 迁移 / 切换
anchor = '/* ───────── 任务链 ───────── */'
saves_code = '''/* ───────── 存档：一个人可以有多条并行的进度 ─────────
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

'''
if "function snapNow()" not in s:
    s = s.replace(anchor, saves_code + anchor, 1)

# 2.5 render(): 加 landing
s = s.replace('''    case "hello": return screenHello();''', '''    case "landing": return screenLanding();
    case "hello": return screenHello();''')

# 2.6 落地页
landing = '''
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
'''
if "function screenLanding()" not in s:
    s = s.replace('function screenHello() {', landing + '\nfunction screenHello() {', 1)

# 2.7 知识点提示
s = s.replace('''    + '已经学过 <b id="kcount">' + totalDone + '</b> 个知识点，在学 <b id="kdoing">' + totalDoing + " 个。</p>"''',
'''    + '已经学过 <b id="kcount">' + totalDone + '</b> 个知识点，在学 <b id="kdoing">' + totalDoing + " 个。</p>"
    + '<p class="legend">标记方法：每个知识点右边有一个按钮——<b>点一下 = 在学</b>，<b>再点一下 = 已学</b>，<b>第三下 = 清空</b>。'
    + "不用勾整门课，勾到你觉得「这块我大概会了」的那一层就行。</p>"''')

# 2.8 知识点按钮 title
s = s.replace("""+ '<button class="tstate ' + st + '" data-act="unit" data-u="' + u.id + '">' + label + "</button>\"""",
"""+ '<button class="tstate ' + st + '" data-act="unit" data-u="' + u.id + '" title="点一下=在学，再点一下=已学，第三下=清空">' + label + "</button>\"""")

# 2.9 侧栏：登录身份 + 落地页时收起步骤
s = s.replace('''function syncRail() {''', '''function syncUserbox() {
  const box = document.getElementById("userbox");
  if (!box) return;
  const me = (window.XJ_ACCOUNT && XJ_ACCOUNT.me) || null;
  box.innerHTML = me
    ? '<div class="uline"><span class="dot-on"></span><b title="' + me.email + '">' + me.email.split("@")[0] + "</b></div>"
      + '<button class="btn small wide" data-act="toAccount">账号与反馈</button>'
    : '<button class="btn small wide primary" data-act="toAccount">登录 / 注册</button>'
      + '<p>登录后进度可跨设备</p>';
}

function syncRail() {''')

s = s.replace('''  const isKnow = S.screen === "know";''', '''  syncUserbox();
  if (rail) rail.classList.toggle("min", S.screen === "landing" || S.screen === "about");
  const isKnow = S.screen === "know";''')

# 2.10 进度页：存档卡
s = s.replace('''    + '<div class="card"><p class="muted small">你补上/完成过的</p>''','''    + savesBlock()
    + '<div class="card"><p class="muted small">你补上/完成过的</p>''')

saves_ui = '''
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
'''
if "function savesBlock()" not in s:
    s = s.replace('function screenProgress() {', saves_ui + '\nfunction screenProgress() {', 1)

# 2.11 事件：toHello / toLanding / 存档操作 / pushNow 同步桥接里的存档
s = s.replace('''    case "toIntro": {''', '''    case "toHello":
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
    case "toIntro": {''')

# 2.12 同步快照带存档
s = s.replace('''    units: Object.assign({}, S.units),''','''    units: Object.assign({}, S.units),
    saves: JSON.parse(JSON.stringify(S.saves || [])),
    activeSave: S.activeSave,''')
s = s.replace('''  if (!S.dir && remote.dir && DIR_BY_ID[remote.dir]) S.dir = remote.dir;''','''  // 存档：按 id 并集；同 id 取「完成件数更多」的那份，避免远端把本地清掉
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

  if (!S.dir && remote.dir && DIR_BY_ID[remote.dir]) S.dir = remote.dir;''')

io.open(p, "w", encoding="utf-8").write(s)
print("app.js patched", len(s))
