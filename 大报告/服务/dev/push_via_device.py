"""用 GitHub 设备授权（device flow）拿一次性令牌，建仓库并推送。

用法：
  python push_via_device.py            # 会打印一个 8 位码，去 https://github.com/login/device 输入
说明：
  - 令牌只在内存与环境变量里，不落盘、不写进 .git/config；
  - 推送时临时顶掉 GCM，避免弹窗。
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CID = "Iv1.b507a08c87ecfe98"  # GitHub CLI 的公开 client id
OWNER = "0-OsealO-0"
REPO = os.environ.get("XJ_REPO_NAME", "xianjian")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def post(url, form, headers=None):
    h = {"accept": "application/json", "user-agent": "xianjian"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=urllib.parse.urlencode(form).encode(), headers=h)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def api(method, path, token, body=None):
    req = urllib.request.Request("https://api.github.com" + path, method=method)
    req.add_header("authorization", "Bearer " + token)
    req.add_header("accept", "application/vnd.github+json")
    req.add_header("user-agent", "xianjian")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=25) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main():
    code = post("https://github.com/login/device/code", {"client_id": CID, "scope": "repo"})
    print("CODE", code["user_code"], flush=True)
    print("URL", code["verification_uri"], flush=True)
    print("等待授权…", flush=True)

    deadline = time.time() + code.get("expires_in", 900) - 20
    interval = max(5, int(code.get("interval", 5)))
    token = ""
    while time.time() < deadline:
        time.sleep(interval)
        try:
            r = post(
                "https://github.com/login/oauth/access_token",
                {
                    "client_id": CID,
                    "device_code": code["device_code"],
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                },
            )
        except Exception as e:
            print("poll-err", e, flush=True)
            continue
        if r.get("access_token"):
            token = r["access_token"]
            break
        err = r.get("error")
        if err == "authorization_pending":
            continue
        if err == "slow_down":
            interval += 5
            continue
        print("AUTH-FAIL", err, r.get("error_description", ""), flush=True)
        return 2

    if not token:
        print("TIMEOUT 没有拿到授权", flush=True)
        return 3

    st, me = api("GET", "/user", token)
    print("LOGIN", me.get("login"), st, flush=True)

    st, repo = api("GET", "/repos/%s/%s" % (OWNER, REPO), token)
    if st == 404:
        st2, created = api(
            "POST",
            "/user/repos",
            token,
            {
                "name": REPO,
                "private": False,
                "description": "先见 · 方向先行的学习引擎：先看见方向，再决定学什么（东南大学《人工智能通识导论》创意作品）",
                "has_issues": True,
                "has_wiki": False,
                "auto_init": False,
            },
        )
        print("CREATE", st2, created.get("html_url"), flush=True)
        if st2 >= 300:
            print("CREATE-FAIL", json.dumps(created)[:300], flush=True)
            return 4
    else:
        print("EXISTS", repo.get("html_url"), flush=True)

    url = "https://github.com/%s/%s.git" % (OWNER, REPO)
    subprocess.run(["git", "remote", "remove", "origin"], cwd=ROOT, capture_output=True)
    subprocess.run(["git", "remote", "add", "origin", url], cwd=ROOT, capture_output=True)
    subprocess.run(["git", "branch", "-M", "main"], cwd=ROOT, capture_output=True)

    env = dict(os.environ)
    env["XJ_TOKEN"] = token
    helper = '!f() { echo "username=%s"; echo "password=$XJ_TOKEN"; }; f' % OWNER
    push = subprocess.run(
        [
            "git",
            "-c",
            "credential.helper=",
            "-c",
            "credential.helper=" + helper,
            "push",
            "-u",
            "origin",
            "main",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env=env,
    )
    print("PUSH", push.returncode, flush=True)
    print((push.stdout or "")[-800:], flush=True)
    print((push.stderr or "")[-800:], flush=True)

    st, repo = api("GET", "/repos/%s/%s" % (OWNER, REPO), token)
    print("VERIFY", st, repo.get("html_url"), repo.get("default_branch"), repo.get("visibility"), flush=True)
    return 0 if push.returncode == 0 else 5


if __name__ == "__main__":
    sys.exit(main())
