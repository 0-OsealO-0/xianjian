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
  window.XJ_ACCOUNT = { me: null, stats: null, busy: false, msg: "", rating: 0, scope: "" };

  async function loadMe() {
    if (!ONLINE) return;
    const j = await api("/api/me");
    if (j && j.ok) XJ_ACCOUNT.me = j.user;
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
    if (!A.me) {
      return head + '<h1>先给自己留个账号。</h1>'
        + '<p class="lede">有账号才能把反馈留在我这边，也才能在换设备时接上进度。'
        + "不想注册也行——不登录照样能用全部功能，只是反馈只存在本机。</p>"
        + '<div class="card">'
        + '<label class="lbl">邮箱</label><input class="input" id="ac-mail" type="email" autocomplete="username" placeholder="you@seu.edu.cn">'
        + '<label class="lbl">密码（至少 8 位）</label><input class="input" id="ac-pw" type="password" autocomplete="current-password" placeholder="不会明文保存，只存 scrypt 哈希">'
        + '<label class="consent"><input type="checkbox" id="ac-ok"> <span>我同意把<strong>邮箱、我写的反馈、以及「完成到第几件事」的计数</strong>保存在你这台服务器上，用于改进这个工具。</span></label>'
        + '<p class="small muted">不记录：IP、设备型号、浏览记录、你输入的任何学习内容。随时可以在本页关闭同意或删除账号。</p>'
        + (A.msg ? '<p class="err">' + A.msg + "</p>" : "")
        + '<div class="foot tight"><button class="btn primary" data-act="register">注册并登录</button>'
        + '<button class="btn" data-act="login">已有账号，登录</button></div></div>'
        + '<div class="foot"><button class="btn ghost" data-act="toProgress">先不注册</button></div></div>';
    }
    const st = A.stats || {};
    return head + '<h1>' + A.me.email + "</h1>"
      + '<p class="lede">' + (A.me.consented ? "你已同意数据用于改进这个工具。" : "你还没有同意数据用途——反馈暂时存不下来。") + "</p>"
      + '<div class="card"><p class="muted small">数据同意</p>'
      + '<p class="small">开启后，我这边会收到：你写的反馈、你完成到第几件事的计数、注册时间。'
      + "关闭后立即停止写入，已写的可以用下面的「删号」清空。</p>"
      + '<div class="foot tight"><button class="btn ' + (A.me.consented ? "" : "primary") + '" data-act="consent" data-v="' + (A.me.consented ? "0" : "1") + '">'
      + (A.me.consented ? "关闭同意" : "开启同意") + "</button></div></div>"
      + '<div class="card"><p class="muted small">留一条反馈</p>'
      + '<label class="lbl">这一步（可不填）</label><input class="input" id="fb-scope" placeholder="例如：自己把 BPSK 画一遍">'
      + '<label class="lbl">好用吗</label><div class="stars">'
      + [1, 2, 3, 4, 5].map((n) => '<button class="star ' + (A.rating >= n ? "on" : "") + '" data-act="rate" data-v="' + n + '">' + n + "</button>").join("")
      + "</div>"
      + '<label class="lbl">哪里卡住 / 哪里不对（写一句也行）</label><textarea class="ta" id="fb-body" placeholder="例：第二步说『装个 Python』，但我不知道该用 conda 还是直接装"></textarea>'
      + (A.msg ? '<p class="' + (A.msg.indexOf("✓") === 0 ? "okmsg" : "err") + '">' + A.msg + "</p>" : "")
      + '<div class="foot tight"><button class="btn primary" data-act="sendFeedback">发出去</button></div></div>'
      + '<div class="card"><p class="muted small">我留下的反馈</p><div id="fb-list">'
      + (A.items && A.items.length
        ? '<ul class="minelist">' + A.items.map((f) => "<li><b>" + (f.scope || "（未指定）") + "</b>"
          + '<span class="vmeta">' + new Date(f.created_at).toLocaleString("zh-CN") + (f.rating ? " · " + f.rating + " 分" : "") + "</span>"
          + "<span>" + String(f.body).replace(/[<>]/g, "") + "</span></li>").join("") + "</ul>"
        : '<p class="small muted">还没有。上面写一条试试。</p>')
      + "</div></div>"
      + '<div class="card"><p class="muted small">这台服务器上的汇总</p>'
      + '<p class="small">注册 ' + (st.users || 0) + " 人 · 同意 " + (st.consented || 0) + " 人 · 反馈 "
      + (st.feedback || 0) + " 条 · 近 7 天活跃 " + (st.active7d || 0) + " 人</p>"
      + '<p class="small muted">这里只有数字，任何人的邮箱都不会出现在页面上。</p></div>'
      + '<div class="foot"><button class="btn" data-act="logout">退出登录</button>'
      + '<button class="btn ghost" data-act="delAccount">删除账号与我的数据</button></div></div>';
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
      refreshAll();
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
      if (j.ok) { A.me.consented = j.consented; A.msg = ""; }
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
