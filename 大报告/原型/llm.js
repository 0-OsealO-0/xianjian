/* 用你自己的模型：key 只存在这台机器的 localStorage 里，不会上传到本站服务器。
   默认接 DeepSeek（浏览器可直连）；也可以改成任何 OpenAI 兼容端点。 */
(function () {
  var KEY = "xianjian.llm";
  var DEFAULT = { base: "https://api.deepseek.com", model: "deepseek-chat", key: "" };

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULT);
      var o = JSON.parse(raw);
      return { base: o.base || DEFAULT.base, model: o.model || DEFAULT.model, key: o.key || "" };
    } catch (e) {
      return Object.assign({}, DEFAULT);
    }
  }

  function set(cfg) {
    var cur = get();
    var next = {
      base: (cfg.base || cur.base || DEFAULT.base).replace(/\/+$/, ""),
      model: cfg.model || cur.model || DEFAULT.model,
      key: cfg.key === undefined ? cur.key : cfg.key,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function endpoint(base) {
    var b = (base || "").replace(/\/+$/, "");
    if (/\/chat\/completions$/.test(b)) return b;
    if (/\/v1$/.test(b)) return b + "/chat/completions";
    return b + "/v1/chat/completions";
  }

  /* 流式对话：每收到一段就调 onDelta(text)，结束后 onDone(fullText)。
     出错时 onError(可读的中文提示)。 */
  function ask(messages, onDelta, onDone, onError) {
    var cfg = get();
    if (!cfg.key) {
      onError("还没填 key。点「接我的模型」填一次，只存在这台电脑上。");
      return;
    }
    var url = endpoint(cfg.base);
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctl) ctl.abort();
    }, 60000);

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ model: cfg.model, stream: true, temperature: 0.4, messages: messages }),
      signal: ctl ? ctl.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            var msg = t;
            try {
              msg = JSON.parse(t).error.message || t;
            } catch (e) {}
            throw new Error(res.status + " " + msg);
          });
        }
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var full = "";
        var buf = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return full;
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop() || "";
            lines.forEach(function (line) {
              var s = line.trim();
              if (!s || s.indexOf("data:") !== 0) return;
              var payload = s.slice(5).trim();
              if (payload === "[DONE]") return;
              try {
                var j = JSON.parse(payload);
                var d = j.choices && j.choices[0] && j.choices[0].delta;
                var t = d && d.content;
                if (t) {
                  full += t;
                  onDelta(t, full);
                }
              } catch (e) {}
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function (full) {
        clearTimeout(timer);
        onDone(full);
      })
      .catch(function (e) {
        clearTimeout(timer);
        var s = String(e && e.message ? e.message : e);
        if (/abort/i.test(s)) s = "超时（60 秒）。网络慢或端点没响应。";
        if (/Failed to fetch|NetworkError/i.test(s)) {
          s = "连不上这个端点。可能是跨域（CORS）被拦，或者 base 地址写错了；可以换成 https://api.deepseek.com 试试。";
        }
        onError(s);
      });
  }

  window.LLM = { get: get, set: set, clear: clear, ask: ask, endpoint: endpoint };
})();
