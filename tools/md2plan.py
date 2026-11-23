"""把 大报告/项目构想_先见_v0.md 渲染成站点里的 plan.html（企划书页）。

只支持这份文稿用到的子集：标题、段落、无序/有序列表、引用、表格、代码块、粗体、行内代码、链接。
"""
import html
import io
import re
import sys

SRC = "大报告/项目构想_先见_v0.md"
OUT = "大报告/原型/plan.html"


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
    return t


def render(md):
    out = []
    lines = md.split("\n")
    i = 0
    n = len(lines)
    in_code = False
    list_kind = None
    while i < n:
        ln = lines[i]
        if ln.startswith("```"):
            if in_code:
                out.append("</pre>")
                in_code = False
            else:
                out.append("<pre>")
                in_code = True
            i += 1
            continue
        if in_code:
            out.append(html.escape(ln, quote=False))
            i += 1
            continue
        if not ln.strip():
            if list_kind:
                out.append("</%s>" % list_kind)
                list_kind = None
            i += 1
            continue
        if re.match(r"^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$", ln):
            if list_kind:
                out.append("</%s>" % list_kind)
                list_kind = None
            out.append("<hr>")
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", ln)
        if m:
            if list_kind:
                out.append("</%s>" % list_kind)
                list_kind = None
            lvl = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (lvl, inline(m.group(2)), lvl))
            i += 1
            continue
        if ln.startswith("|") and i + 1 < n and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            if list_kind:
                out.append("</%s>" % list_kind)
                list_kind = None
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            out.append('<div class="tablewrap"><table><thead><tr>' + "".join("<th>%s</th>" % inline(c) for c in cells) + "</tr></thead><tbody>")
            i += 2
            while i < n and lines[i].startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>" + "".join("<td>%s</td>" % inline(c) for c in row) + "</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue
        if ln.startswith(">"):
            if list_kind:
                out.append("</%s>" % list_kind)
                list_kind = None
            out.append("<blockquote>%s</blockquote>" % inline(ln.lstrip("> ").strip()))
            i += 1
            continue
        m = re.match(r"^\s*[-*]\s+(.*)$", ln)
        if m:
            if list_kind != "ul":
                if list_kind:
                    out.append("</%s>" % list_kind)
                out.append("<ul>")
                list_kind = "ul"
            out.append("<li>%s</li>" % inline(m.group(1)))
            i += 1
            continue
        m = re.match(r"^\s*\d+\.\s+(.*)$", ln)
        if m:
            if list_kind != "ol":
                if list_kind:
                    out.append("</%s>" % list_kind)
                out.append("<ol>")
                list_kind = "ol"
            out.append("<li>%s</li>" % inline(m.group(1)))
            i += 1
            continue
        if list_kind:
            out.append("</%s>" % list_kind)
            list_kind = None
        out.append("<p>%s</p>" % inline(ln))
        i += 1
    if list_kind:
        out.append("</%s>" % list_kind)
    if in_code:
        out.append("</pre>")
    return "\n".join(out)


TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>先见 · 完整企划书</title>
<style>
:root { --paper:#f7f4ee; --card:#fffdf8; --ink:#1b1c1f; --ink2:#3b3f47; --muted:#6e7178; --line:#e3ddd1; --accent:#1f4fd8; --amber:#b4530a; --serif:"Source Han Serif SC","Noto Serif CJK SC",Songti SC,SimSun,Georgia,serif; }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.95 -apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif; }
header { position:sticky; top:0; background:rgba(247,244,238,.94); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:12px 20px; display:flex; gap:14px; align-items:center; font-size:13.5px; }
header b { font-family:var(--serif); font-size:16px; }
header a { color:var(--accent); text-decoration:none; }
main { max-width:780px; margin:0 auto; padding:30px 22px 90px; }
h1 { font-family:var(--serif); font-size:31px; line-height:1.45; margin:34px 0 14px; }
h2 { font-family:var(--serif); font-size:24px; margin:38px 0 12px; padding-bottom:6px; border-bottom:1px solid var(--line); }
h3 { font-size:18px; margin:26px 0 8px; }
h4 { font-size:16px; margin:20px 0 6px; color:var(--ink2); }
p { margin:0 0 14px; color:var(--ink2); }
strong { color:var(--ink); }
code { background:#efe9dc; padding:1px 5px; border-radius:4px; font-size:13.5px; }
pre { background:#26272b; color:#e8e6e1; padding:14px 16px; border-radius:10px; overflow:auto; font-size:13px; line-height:1.7; }
.tablewrap { overflow-x:auto; -webkit-overflow-scrolling:touch; margin:14px 0 18px; }
table { width:100%; border-collapse:collapse; font-size:14px; }
.tablewrap table { margin:0; min-width:560px; }
th, td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
th { background:#f2eee3; }
hr { border:0; border-top:1px solid var(--line); margin:26px 0; }
blockquote { margin:14px 0; padding:8px 14px; border-left:3px solid var(--amber); background:#faf6ec; color:var(--ink2); }
ul, ol { margin:0 0 14px; padding-left:22px; color:var(--ink2); }
li { margin:4px 0; }
a { color:var(--accent); }
footer { max-width:780px; margin:0 auto; padding:0 22px 60px; font-size:13px; color:var(--muted); }
@media (max-width:620px) {
  h1 { font-size:26px; }
  h2 { font-size:21px; }
  main { padding:20px 16px calc(70px + env(safe-area-inset-bottom)); }
  header { padding:10px 14px; gap:10px; flex-wrap:wrap; font-size:12.5px; }
  .tablewrap table { font-size:13px; }
  th, td { padding:7px 8px; }
}
</style>
</head>
<body>
<header><b>先见</b><span style="color:var(--muted)">完整企划书</span><a href="index.html">← 回到网站</a><a href="项目构想_先见_v0.md" target="_blank">Markdown 原文</a></header>
<main>
__BODY__
</main>
<footer>这是课程作品《先见》的完整设想文档，用来解释它为什么这么设计、风险在哪、以及接下来准备怎么做。网站上的落地页只讲三句话，细节都在这里。</footer>
</body>
</html>
"""


def main():
    md = io.open(SRC, encoding="utf-8").read()
    body = render(md)
    io.open(OUT, "w", encoding="utf-8").write(TEMPLATE.replace("__BODY__", body))
    print("wrote", OUT, len(body), "chars")


if __name__ == "__main__":
    main()
