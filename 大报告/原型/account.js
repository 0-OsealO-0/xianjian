/* 先见 · 账号与反馈（可选层）
   没有起服务时，这一页只显示「本机模式」，不影响任何主流程。
   起服务后：注册/登录、留反馈、看自己的反馈、开关同意、删号。
*/

(function () {
  const ONLINE = /^https?:$/.test(location.protocol);

  const api = async (p, opt) => {
    const o = Object.assign({ headers: {}, credentials: "same-origin" }, opt || {});
    if (o.body) {
      o.headers["content-type"] = "application/json";
      o.body = JSON.stringify(o.body);
    }
    const r = await fetch(p, o);
    let j = {};
    try { j = await r.json(); } catch (e) { j = { ok: false, reason: "服务没回话" }; }
    return j;
  };

  /* ── 服务探测 + 当前用户 ── */
  window.XJ_ACCOUNT = {
    me: null, stats: null, busy: false, msg: "", pwMsg: "", rating: 0, scope: "",
    syncAt: 0, syncMsg: "", syncBusy: false,
  };

  /* 数据怎么用：一段成文说明，挂在页面上，不用去翻别的文件 */
  function privacyBlock() {
    return '<details class="card privacy"><summary>数据是怎么用的（点开看细节）</summary>'
      + '<div class="small">'
      + '<p><b>收什么</b>：邮箱、密码哈希（scrypt，不可逆）、你写的反馈、以及「完成到第几件」的计数。</p>'
      + '<p><b>不收什么</b>：IP（只在内存里做 1 分钟限流，不写库）、设备型号、浏览记录、'
      + '你输入的代码/笔记/想法（那些只在你这台电脑上）。</p>'
      + '<p><b>存多久</b>：反馈 ≤ 12 个月；账号存到你删号；登录令牌 30 天过期。</p>'
      + '<p><b>谁能看</b>：你只看得到自己的；管理员能在 <code>/admin.html</code> 看汇总与反馈（含邮箱，便于回访）；'
      + '其他人什么都看不到。</p>'
      + '<p><b>怎么撤回</b>：关闭同意 → 立刻停止写入；删除账号 → 级联删掉反馈、会话与事件，不可恢复。</p>'
      + '<p class="muted">试用版不收集敏感信息，也请不要写别人的隐私。</p>'
      + '</div></details>';
  }

  /* ── 进度同步（只同步结构性进度：任务、知识点、成就、专业/方向） ── */
  let pushTimer = null;

  function bridge() {
    return window.XJ_BRIDGE || null;
  }

  async function pullMerge(quiet) {
    const A = XJ_ACCOUNT;
    const B = bridge();
    if (!A.me || !B) return { added: 0 };
    const j = await api("/api/progress");
    if (!j || !j.ok) {
      if (!quiet) A.syncMsg = (j && j.reason) || "拉取失败";
      return { added: 0 };
    }
    A.syncAt = j.updated_at || 0;
    const r = B.merge(j.data);
    if (r.added > 0) {
      B.repaint();
      A.syncMsg = "已合并另一台设备上的 " + r.added + " 条进度";
    } else if (!quiet) {
      A.syncMsg = j.data ? "已经是最新的" : "云端还没有进度";
    }
    return r;
  }

  async function pushNow(quiet) {
    const A = XJ_ACCOUNT;
    const B = bridge();
    if (!A.me || !B) return false;
    if (!A.me.consented) {
      if (!quiet) A.syncMsg = "需要先勾选同意，我才能保存进度";
      return false;
    }
    A.syncBusy = true;
    const j = await api("/api/progress", { method: "PUT", body: { data: B.snapshot() } });
    A.syncBusy = false;
    if (j && j.ok) {
      A.syncAt = j.updated_at || Date.now();
      A.syncMsg = "已同步 · " + timeOf(A.syncAt);
      return true;
    }
    A.syncMsg = (j && j.reason) || "同步失败";
    return false;
  }

  function onLocalChange() {
    const A = XJ_ACCOUNT;
    if (!A.me || !A.me.consented || !ONLINE || !bridge()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushNow(true); }, 1500);
  }

  function timeOf(ts) {
    if (!ts) return "还没同步过";
    const d = new Date(ts);
    const pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getMonth() + 1 + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  window.XJ_ACCOUNT.onLocalChange = onLocalChange;

  async function loadMe() {
    if (!ONLINE) return;
    const j = await api("/api/me");
    if (j && j.ok) {
      XJ_ACCOUNT.me = j.user;
      await pullMerge(true);
      if (XJ_ACCOUNT.me && XJ_ACCOUNT.me.consented) pushNow(true);
    }
    paint(false);
  }

  /* ── 页面 ── */
  function screenAccount() {
    const A = XJ_ACCOUNT;
    const head = '<div class="wrap narrow"><p class="kicker">账号 · 反馈</p>';

    if (!ONLINE) {
      return head + '<h1>这一页要起本机服务才能用。</h1>'
        + '<p class="lede">双击 <code>启动服务.cmd</code>，然后访问 <code>http://127.0.0.1:8787/</code>。'
        + "本机模式下所有数据都只在这台电脑上（localStorage），不会有账号，也不会上传。</p>"
        + '<div class="foot"><button class="btn" data-act="toProgress">回我的进度</button></div></div>';
    }

    /* 未登录：一张卡，说明折叠在后面 */
    if (!A.me) {
      return head + '<div class="card onecard">'
        + '<h1 class="onecard-h1">先给自己留个账号。</h1>'
        + '<p class="onecard-sub">有账号才能把反馈留下、换设备接上进度；不登录也能用，只是都只在这台电脑上。</p>'
        + '<label class="lbl">邮箱</label><input class="input" id="ac-mail" type="email" autocomplete="username" placeholder="you@seu.edu.cn">'
        + '<label class="lbl">密码（至少 8 位）</label><input class="input" id="ac-pw" type="password" autocomplete="current-password" placeholder="不会明文保存">'
        + '<label class="consent"><input type="checkbox" id="ac-ok"> <span>我同意把<strong>邮箱、我写的反馈、以及学习进度（做到哪一件、标记过哪些知识点、专业与方向）</strong>存在这台服务器上，用来改进这个工具、并在换设备时接上进度。</span></label>'
        + (A.msg ? '<p class="err">' + A.msg + '</p>' : '')
        + '<div class="foot tight"><button class="btn primary" data-act="register">注册并登录</button>'
        + '<button class="btn" data-act="login">已有账号，登录</button></div>'
        + privacyBlock()
        + '<div class="foot tight"><button class="btn ghost" data-act="toProgress">先不注册，继续用</button></div>'
        + '</div></div>';
    }

    /* 已登录：一张卡 + 折叠项 */
    const st = A.stats || {};
    return head + '<div class="card onecard">'
      + '<div class="onecard-top"><div><b class="onecard-mail">' + A.me.email + '</b>'
      + '<span class="small muted">' + (A.me.consented ? "已同意数据用于改进" : "还没同意数据用途") + '</span></div>'
      + '<button class="btn small ghost" data-act="logout">退出</button></div>'
      + (A.me.admin ? '<div class="foot tight"><a class="btn primary" href="admin.html">打开管理端 →</a>'
        + '<span class="small muted">你是管理员，不用再输令牌</span></div>' : '')

      + '<p class="small muted">最近一次同步：' + (A.syncAt ? timeOf(A.syncAt) : "还没同步过")
      + (A.syncBusy ? " · 正在上传…" : "") + '</p>'
      + (A.syncMsg ? '<p class="small">' + A.syncMsg + '</p>' : '')
      + '<div class="foot tight"><button class="btn primary" data-act="pushNow">现在上传</button>'
      + '<button class="btn" data-act="syncNow">从云端拉一次</button></div>'

      + '<details class="fold"><summary>数据同意（' + (A.me.consented ? "开" : "关") + '）</summary>'
      + '<p class="small">开启后我这边会收到：你写的反馈、学习进度（做到哪一件、标过哪些知识点）、注册时间。关闭后立即停止写入。</p>'
      + '<div class="foot tight"><button class="btn ' + (A.me.consented ? "" : "primary") + '" data-act="consent" data-v="' + (A.me.consented ? "0" : "1") + '">'
      + (A.me.consented ? "关闭同意" : "开启同意") + '</button></div></details>'

      + privacyBlock()

      + '<details class="fold"><summary>留一条反馈' + (A.items && A.items.length ? "（已留 " + A.items.length + " 条）" : "") + '</summary>'
      + '<label class="lbl">这一步（可不填）</label><input class="input" id="fb-scope" placeholder="例如：自己把 BPSK 画一遍">'
      + '<label class="lbl">好用吗</label><div class="stars">'
      + [1, 2, 3, 4, 5].map(function (n) { return '<button class="star ' + (A.rating >= n ? "on" : "") + '" data-act="rate" data-v="' + n + '">' + n + "</button>"; }).join("")
      + '</div>'
      + '<label class="lbl">哪里卡住 / 哪里不对（写一句也行）</label><textarea class="ta" id="fb-body" placeholder="例：第二步说『装个 Python』，但我不知道该用 conda 还是直接装"></textarea>'
      + (A.msg ? '<p class="' + (A.msg.indexOf("✓") === 0 ? "okmsg" : "err") + '">' + A.msg + "</p>" : "")
      + '<div class="foot tight"><button class="btn primary" data-act="sendFeedback">发出去</button></div>'
      + (A.items && A.items.length
        ? '<ul class="minelist">' + A.items.map(function (f) {
            return "<li><b>" + (f.scope || "（未指定）") + "</b>"
              + '<span class="vmeta">' + new Date(f.created_at).toLocaleString("zh-CN") + (f.rating ? " · " + f.rating + " 分" : "") + "</span>"
              + "<span>" + String(f.body).replace(/[<>]/g, "") + "</span></li>";
          }).join("") + "</ul>"
        : "")
      + '</details>'

      + '<details class="fold"><summary>改密码</summary>'
      + '<p class="small muted">改完这个账号的密码就换成新的了，其他设备上的登录不受影响。</p>'
      + '<label class="lbl">当前密码</label><input class="input" id="pw-cur" type="password" placeholder="现在用的密码">'
      + '<label class="lbl">新密码（至少 8 位）</label><input class="input" id="pw-new" type="password" placeholder="新的密码">'
      + (A.pwMsg ? '<p class="' + (A.pwMsg.indexOf("✓") === 0 ? "okmsg" : "err") + '">' + A.pwMsg + "</p>" : "")
      + '<div class="foot tight"><button class="btn primary" data-act="changePw">改密码</button></div></details>'

      + '<details class="fold"><summary>这台服务器上的汇总</summary>'
      + '<p class="small">注册 ' + (st.users || 0) + " 人 · 同意 " + (st.consented || 0) + " 人 · 反馈 "
      + (st.feedback || 0) + " 条 · 近 7 天活跃 " + (st.active7d || 0) + " 人</p>"
      + '<p class="small muted">这里只有数字，任何人的邮箱都不会出现在页面上。</p></details>'

      + '<div class="onecard-foot"><button class="btn ghost tiny" data-act="delAccount">删除账号与我的数据</button></div>'
      + '</div></div>';
  }

  /* ── 事件 ── */
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const A = XJ_ACCOUNT;
    if (act === "toAccount") {
      S.screen = "account";
      paint(false);
      refreshAll();
      if (XJ_ACCOUNT.me) {
        pullMerge(true).then(function () { paint(false); });
      }
      return;
    }
    if (act === "rate") {
      A.rating = Number(b.dataset.v);
      paint(false);
      return;
    }
    if (act === "register" || act === "login") {
      const mail = (document.getElementById("ac-mail") || {}).value || "";
      const pw = (document.getElementById("ac-pw") || {}).value || "";
      const ok = !!(document.getElementById("ac-ok") || {}).checked;
      A.msg = "";
      const j = await api("/api/" + act, { method: "POST", body: { email: mail, password: pw, consented: ok } });
      if (!j.ok) { A.msg = j.reason || "没成功"; paint(false); return; }
      A.me = j.user;
      await pullMerge(true);
      if (A.me.consented) await pushNow(true);
      refreshAll();
      return;
    }
    if (act === "syncNow") {
      A.syncBusy = true;
      paint(false);
      await pullMerge(false);
      A.syncBusy = false;
      paint(false);
      return;
    }
    if (act === "pushNow") {
      A.syncBusy = true;
      paint(false);
      await pushNow(false);
      A.syncBusy = false;
      paint(false);
      return;
    }
    if (act === "logout") {
      await api("/api/logout", { method: "POST" });
      A.me = null; A.items = null; A.msg = "";
      paint(false);
      return;
    }
    if (act === "consent") {
      const j = await api("/api/consent", { method: "POST", body: { consented: b.dataset.v === "1" } });
      if (j.ok) {
        A.me.consented = j.consented;
        A.msg = "";
        if (j.consented) await pushNow(true);
      }
      refreshAll();
      return;
    }
    if (act === "sendFeedback") {
      const scope = (document.getElementById("fb-scope") || {}).value || "";
      const body = (document.getElementById("fb-body") || {}).value || "";
      const j = await api("/api/feedback", { method: "POST", body: { scope, rating: A.rating, body } });
      A.msg = j.ok ? "✓ 收到了，谢谢" : (j.reason || "没发出去");
      if (j.ok) { A.rating = 0; }
      refreshAll();
      return;
    }
    if (act === "changePw") {
      const cur = ($("pw-cur") || {}).value || "";
      const next = ($("pw-new") || {}).value || "";
      A.pwMsg = "";
      if (!cur || !next) { A.pwMsg = "两个都要填"; paint(false); return; }
      if (next.length < 8) { A.pwMsg = "新密码至少 8 位"; paint(false); return; }
      const j = await api("/api/password", { method: "POST", body: JSON.stringify({ current: cur, next: next }) });
      A.pwMsg = j && j.ok ? "✓ 改好了，下次用新密码登录" : ((j && j.reason) || "没改成，再试一次");
      paint(false);
      return;
    }

    if (act === "delAccount") {
      if (!confirm("删除账号会同时删掉你留下的所有反馈，且不可恢复。确定？")) return;
      await api("/api/me", { method: "DELETE" });
      A.me = null; A.items = null; A.stats = null; A.msg = "";
      paint(false);
      return;
    }
  });

  async function refreshAll() {
    if (!ONLINE) return;
    if (!XJ_ACCOUNT.me) { paint(false); return; }
    const [f, s] = await Promise.all([api("/api/feedback"), api("/api/stats")]);
    if (f && f.ok) XJ_ACCOUNT.items = f.items;
    if (s && s.ok) XJ_ACCOUNT.stats = s;
    paint(false);
  }

  /* 包一层 render */
  const base = render;
  render = function () {
    if (S.screen === "account") return screenAccount();
    return base();
  };

  /* 启动 */
  loadMe();
})();
