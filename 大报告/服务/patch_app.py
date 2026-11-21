import io

p = 'app.js'
s = io.open(p, encoding='utf-8').read()

if 'const NET = { ok: false' not in s:
    s = s.replace('let S = load();', """let S = load();

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
}""")

if 'mine: [],' not in s:
    s = s.replace('  evidence: {},', '  evidence: {},\n  mine: [],\n  vidRes: null,')

anchor = '    + \'<div class="resrow airow"><span class="rk">找老师</span>\''
addition = """    + '<div class="resrow"><span class="rk">就地搜</span>'
    + (NET.ok
      ? '<button class="btn small" data-act="findVid" data-kw="' + r.kw.replace(/"/g, "&quot;") + '">在 B 站找 3 个候选</button>'
        + '<span class="small muted">不用跳走，直接看标题 / 时长 / 播放量</span>'
      : '<span class="small muted">要就地搜，用本机服务打开：<code>node 服务/server.mjs</code>，再访问 http://127.0.0.1:8787/</span>')
    + "</div>"
    + vidResBlock(r.kw)
""" + anchor

if 'vidResBlock(r.kw)' not in s:
    assert anchor in s
    s = s.replace(anchor, addition)

helper = """
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

"""
if 'function vidResBlock' not in s:
    s = s.replace('function resBlock(t) {', helper + 'function resBlock(t) {')

acts = """    case "findVid": {
      const kw = b.dataset.kw || "";
      S.vidRes = { kw: kw, loading: true };
      paint(false);
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
    case "aiTeacher":"""

if 'case "findVid"' not in s:
    anchor2 = '    case "aiTeacher":'
    assert anchor2 in s
    s = s.replace(anchor2, acts, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
