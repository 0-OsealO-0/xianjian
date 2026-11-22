import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8").read()
if 'teach.js' not in s:
    old = '  <script src="data.js?v=324"></script>'
    assert old in s, "index.html 锚点没找到"
    s = s.replace(old, '  <script src="data.js?v=324"></script>\n  <script src="teach.js?v=324"></script>', 1)
s = s.replace("v=324", "v=325")
io.open(P, "w", encoding="utf-8").write(s)

A = "app.js"
a = io.open(A, encoding="utf-8").read()

# 1) 用「具体清单」替换原来的「去哪学」开头
old_head = """  return '<div class="card"><p class="muted small">去哪学（这一步的）</p>'"""
new_head = """  const refs = (window.REFS && window.REFS[t.unit || ""]) || (window.TEACH && window.TEACH[t.unit || ""] && window.TEACH[t.unit || ""].refs) || [];
  const refHtml = refs.map((r) => '<li>' + r + "</li>").join("");
  const docHtml = r.doc ? '<li><a class="reslink" href="' + r.doc.url + '" target="_blank" rel="noopener">' + r.doc.name + ' ↗</a> <span class="small muted">（官方文档，先读开头那节就够）</span></li>' : "";
  const listHtml = (refHtml || docHtml || courseHtml)
    ? '<p class="small muted" style="margin:0 0 4px">直接看这些</p><ul class="reflist">' + refHtml + courseHtml2 + docHtml + "</ul>"
    : "";
  return '<div class="card"><p class="muted small">这一步的资源和讲解</p>' + listHtml"""
assert old_head in a, "resBlock 开头锚点没找到"
a = a.replace(old_head, new_head, 1)

# 2) 课程项改成 li（用于 reflist）
old_course = """  const courseHtml = courses.map((c) =>
    '<div class="cr"><a class="crtitle" href="' + c.url + '" target="_blank" rel="noopener">' + c.title + '</a>'
    + '<span class="crumb">' + c.by + (c.kind === "search" ? " · 需自己挑一个" : "") + "</span>"
    + (c.note ? '<span class="crnote">' + c.note + "</span>" : "") + "</div>").join("");"""
new_course = """  const courseHtml = courses.map((c) =>
    '<div class="cr"><a class="crtitle" href="' + c.url + '" target="_blank" rel="noopener">' + c.title + '</a>'
    + '<span class="crumb">' + c.by + (c.kind === "search" ? " · 需自己挑一个" : "") + "</span>"
    + (c.note ? '<span class="crnote">' + c.note + "</span>" : "") + "</div>").join("");
  const courseHtml2 = courses.map((c) =>
    '<li><a class="reslink" href="' + c.url + '" target="_blank" rel="noopener">' + c.title + ' ↗</a>'
    + '<span class="small muted"> · ' + c.by + (c.note ? " · " + c.note : "") + "</span></li>").join("");"""
assert old_course in a, "courseHtml 锚点没找到"
a = a.replace(old_course, new_course, 1)

# 3) 把「人工筛过的」块与搜索行改成可折叠的「搜不到再看」
old_mid = """    + (courseHtml ? '<div class="courses"><p class="small muted" style="margin:0 0 2px">人工筛过的</p>' + courseHtml + "</div>" : "")
    + '<div class="resrow"><span class="rk">看视频</span>'"""
new_mid = """    + '<details class="fold2"><summary>搜不到，或者想多找几门</summary>'
    + '<div class="resrow"><span class="rk">看视频</span>'"""
assert old_mid in a, "courses 块锚点没找到"
a = a.replace(old_mid, new_mid, 1)

old_tail = """    + vidResBlock(r.kw)
    + '<div class="resrow airow"><span class="rk">找老师</span>'
    + '<button class="btn small" data-act="aiTeacher">让 AI 讲这一节</button>'
    + '<span class="small muted">会给你一段可以直接粘进 ChatGPT / DeepSeek 的提示词（含你的进度）</span></div>'
    + (S.aiOpen ? aiPanel(t) : "")
    + "</div>";"""
new_tail = """    + vidResBlock(r.kw)
    + "</details>"
    + '<div class="resrow airow"><span class="rk">问老师</span>'
    + '<button class="btn small primary" data-act="aiTeacher">' + (S.aiOpen ? "收起讲解" : "站内讲一遍") + "</button>"
    + '<button class="btn small" data-act="copyPrompt">复制提示词（去问真模型）</button></div>'
    + (S.aiOpen ? teachPanel(t) : "")
    + (S.promptOpen ? aiPanel(t) : "")
    + "</div>";"""
assert old_tail in a, "尾部锚点没找到"
a = a.replace(old_tail, new_tail, 1)

# 4) 插入 teachPanel()
anchor = "function aiPanel(t) {"
assert anchor in a, "aiPanel 锚点没找到"
teach = '''function teachFor(t) {
  const T = window.TEACH || {};
  if (t.unit && T[t.unit]) return T[t.unit];
  if (t.unit && typeof FIX !== "undefined" && FIX[t.unit]) {
    const f = FIX[t.unit];
    return {
      gist: f.why,
      steps: f.how,
      check: ["这一块讲完后，你能用一个工程上的例子说明它用在哪吗？",
        "如果只记住一句话，你会记哪句？",
        "你打算用多久把这里的第一个例子跑一遍？"],
      wrong: "只看不写。这一块至少要有一个你自己敲出来的例子。",
    };
  }
  return {
    gist: t.why || "这一步的目标是让你先摸到东西，再回头看理论。",
    steps: t.how || [],
    check: [t.ask ? t.ask.q : "你能把这一步的做法讲给同学听吗？",
      "你刚才做的和书上的说法对得上吗？",
      "哪一步是你猜的？"],
    wrong: "先查资料再动手。这一步应该反过来：先动手，卡住了再查。",
  };
}

function teachPanel(t) {
  const L = teachFor(t);
  const list = (arr, cls) => (arr || []).map((x, i) => '<li class="' + (cls || "") + '">' + x + "</li>").join("");
  return '<div class="aibox teach">'
    + '<p class="small muted" style="margin:0 0 6px">站内讲解（写字的人不是模型，是写好的；想追问就用下面的提示词去问真模型）</p>'
    + '<div class="lesson"><b>先说清楚这一节在干嘛</b><p>' + L.gist + "</p></div>"
    + (L.steps && L.steps.length ? '<div class="lesson"><b>分 ' + L.steps.length + ' 步做</b><ol class="tight">' + list(L.steps) + "</ol></div>" : "")
    + (L.check && L.check.length ? '<div class="lesson"><b>你现在能回答这三个吗</b><ol class="tight">' + list(L.check) + "</ol></div>" : "")
    + (L.wrong ? '<div class="lesson warn"><b>最常见的坑</b><p>' + L.wrong + "</p></div>" : "")
    + "</div>";
}

'''
a = a.replace(anchor, teach + anchor, 1)

# 5) 事件：copyPrompt 打开提示词面板
old_ev = 'if (act === "closeAI") { S.aiOpen = false; paint(false); return; }'
assert old_ev in a, "closeAI 事件锚点没找到"
a = a.replace(old_ev, old_ev + '\n    if (act === "copyPrompt") { S.promptOpen = !S.promptOpen; paint(false); return; }', 1)

io.open(A, "w", encoding="utf-8").write(a)
print("patched index.html + app.js")
