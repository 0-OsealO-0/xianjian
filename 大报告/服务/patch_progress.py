import io

p = 'app.js'
s = io.open(p, encoding='utf-8').read()

anchor = """    + '<div class="card"><p class="muted small">知识进度</p>'"""

block = """    + '<div class="card"><p class="muted small">我收下的课</p>'
    + ((S.mine || []).length
      ? '<ul class="minelist">' + S.mine.map(function (m) {
          return '<li><a href="' + m.url + '" target="_blank" rel="noopener">' + m.title + '</a>'
            + '<span class="vmeta">' + m.author + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="small muted">还没有。任务页「就地搜」出来的候选，点「收进我的清单」就会存到这里。</p>')
    + '</div>'
"""

if '我收下的课' not in s:
    assert anchor in s, 'anchor not found'
    s = s.replace(anchor, block + anchor, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
