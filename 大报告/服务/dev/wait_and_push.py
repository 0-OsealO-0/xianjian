"""等仓库出现，然后推送 main。

用户手动在网页建好空仓库（public 或 private 都可以）后，这个脚本会在
10 分钟内察觉到，自动设置 remote、建 main、提交未入库的文件并推送。
"""

import os
import subprocess
import sys
import time

OWNER = "0-OsealO-0"
REPO = os.environ.get("XJ_REPO_NAME", "xianjian")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
URL = "https://github.com/%s/%s.git" % (OWNER, REPO)


def run(args, **kw):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, **kw)


def exists():
    # 公开仓库：不加认证也能 ls-remote；私有仓库会返回 128，需要用户确认后再说
    r = run(["git", "ls-remote", URL], env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
    return r.returncode == 0


def main():
    print("等待仓库出现：", URL, flush=True)
    deadline = time.time() + 600
    while time.time() < deadline:
        if exists():
            print("仓库已存在，开始推送", flush=True)
            break
        time.sleep(5)
    else:
        print("TIMEOUT 10 分钟内没等到仓库", flush=True)
        return 2

    run(["git", "remote", "remove", "origin"])
    run(["git", "remote", "add", "origin", URL])
    run(["git", "branch", "-M", "main"])
    run(["git", "add", "-A"])
    st = run(["git", "status", "--porcelain"])
    if st.stdout.strip():
        c = run(["git", "commit", "-m", "dev: 设备授权推送脚本"])
        print("commit", c.returncode, (c.stdout + c.stderr)[-300:], flush=True)

    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    push = run(["git", "push", "-u", "origin", "main"], env=env)
    print("PUSH", push.returncode, flush=True)
    print((push.stdout or "")[-600:], flush=True)
    print((push.stderr or "")[-600:], flush=True)
    if push.returncode != 0:
        print("NEED-TOKEN 推送需要认证，改用设备授权脚本", flush=True)
        return 3
    print("DONE", URL.replace(".git", ""), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
