"""一键部署到 Cloudflare Workers（需要两个环境变量）

    CLOUDFLARE_API_TOKEN   在 dash.cloudflare.com/profile/api-tokens 建，模板 Edit Cloudflare Workers
    CLOUDFLARE_ACCOUNT_ID  在 dash.cloudflare.com 右侧栏

用法：
    python 大报告/服务/workers/deploy.py

做四件事：建库（已存在就复用）→ 填 database_id → 建表 → 传 ADMIN_TOKEN → 部署 → 自检
"""

import json
import os
import re
import secrets
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WRANGLER = os.path.join(REPO, "tools", "wrangler", "node_modules", "wrangler", "bin", "wrangler.js")
TOML = os.path.join(HERE, "wrangler.toml")
DB = "xianjian"
WORKER = "xianjian"


def w(args, stdin=None, check=True):
    cmd = ["node", WRANGLER] + args
    p = subprocess.run(cmd, cwd=HERE, input=stdin, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (p.stdout or "") + (p.stderr or "")
    if check and p.returncode != 0:
        print("失败：", " ".join(args))
        print(out[-1200:])
        sys.exit(p.returncode)
    return out


def find_db_id():
    out = w(["d1", "list", "--json"])
    m = re.search(r"\[[\s\S]*\]", out)
    if m:
        try:
            for row in json.loads(m.group(0)):
                if row.get("name") == DB:
                    return row.get("uuid") or row.get("id")
        except Exception:
            pass
    return ""


def load_local():
    """允许把凭据放在 cf.local.json（已在 .gitignore），免得每次 export。"""
    p = os.path.join(HERE, "cf.local.json")
    if not os.path.exists(p):
        return
    try:
        d = json.load(open(p, encoding="utf-8"))
    except Exception as e:
        print("读 cf.local.json 失败：", e)
        return
    for k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
        if not os.environ.get(k) and d.get(k):
            os.environ[k] = d[k]


def main():
    load_local()
    if not os.environ.get("CLOUDFLARE_API_TOKEN") or not os.environ.get("CLOUDFLARE_ACCOUNT_ID"):
        print("缺少环境变量 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID")
        return 2

    print("1) 检查身份…")
    print(w(["whoami"]).strip()[-400:])

    print("2) 数据库…")
    db_id = find_db_id()
    if not db_id:
        out = w(["d1", "create", DB])
        print(out.strip()[-400:])
        m = re.search(r'"?(?:uuid|database_id)"?\s*[:=]\s*"?([0-9a-f-]{32,36})', out)
        db_id = m.group(1) if m else find_db_id()
    if not db_id:
        print("没拿到 database_id，停。")
        return 3
    print("   database_id =", db_id)

    s = open(TOML, encoding="utf-8").read()
    s = re.sub(r'database_id\s*=\s*"[^"]*"', 'database_id = "%s"' % db_id, s)
    open(TOML, "w", encoding="utf-8").write(s)
    print("   已写入 wrangler.toml")

    print("3) 建表…")
    print(w(["d1", "migrations", "apply", DB, "--remote", "--force"]).strip()[-400:])

    print("4) 管理员令牌…")
    admin = os.environ.get("ADMIN_TOKEN") or secrets.token_urlsafe(18)
    w(["secret", "put", "ADMIN_TOKEN"], stdin=admin + "\n")
    print("   ADMIN_TOKEN =", admin)
    print("   （记下来，/admin.html 要用；也会写进 accounts.txt）")

    print("5) 部署…")
    out = w(["deploy"])
    print(out.strip()[-800:])
    m = re.search(r"https://[a-z0-9.-]+\.workers\.dev", out)
    url = m.group(0) if m else ""

    with open(os.path.join(HERE, "accounts.txt"), "w", encoding="utf-8") as f:
        f.write("worker: %s\nADMIN_TOKEN: %s\nurl: %s\n" % (WORKER, admin, url))

    if url:
        print("6) 自检…")
        try:
            with urllib.request.urlopen(url + "/api/health", timeout=20) as r:
                print("   /api/health →", r.read().decode()[:200])
        except Exception as e:
            print("   自检失败：", e)
        print("\n上线地址：", url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
