# 参与开发 · 先见

先见是一个零依赖的学习引擎原型：静态前端 + 一个 Node 小服务（可选的数据层）。
一个人开发时怎么顺手都行；多人一起改，下面几条是**必须**的，否则会在冲突、缓存和线上数据上卡住。

如果你只是想试用，请看 [大报告/试用/试用说明_给同学.md](大报告/试用/试用说明_给同学.md)，不用读这份。

---

## 1. 30 秒跑起来

```bash
git clone https://github.com/0-OsealO-0/xianjian.git
cd xianjian
node --version                     # 需要 >= 22（本机 SQLite 用 node:sqlite）

# 纯静态：双击 大报告/原型/index.html 就能看
# 带接口：起本机服务（默认 127.0.0.1:8787，数据落在 大报告/服务/data/app.db）
npm start

# 接口冒烟测试（起临时实例 + 临时数据库，不碰你本机的 app.db）
npm test
```

`npm test` 只测接口与静态文件，不测界面；界面靠手动走一遍主流程 + 手机视口截图（见 PR 模板）。

## 2. 三条硬规则

1. **不要提交密钥和真实数据。** `.env`、`大报告/服务/workers/cf.local.json`、`accounts.txt`、`大报告/服务/data/` 都已在 `.gitignore` 里，别用 `git add -f` 绕过。本地开发只用 SQLite；D1 凭据和 `ADMIN_TOKEN` 只存在于维护者机器和 Railway 环境变量里，不发给协作者。
2. **不要直接 push `main`。** 一切改动走分支 + PR，至少 1 个 review。`main` 受分支保护，合并即发布（Railway 会自动部署）。
3. **一个 PR 只做一件事。** `app.js` 有 60KB+，混着改会让 review 看不到关键行。

## 3. 文件领地

无构建、大单文件，**按文件分工**比按功能分工更有效。两个人不要同时改同一个大文件。

| 文件 / 目录 | 归谁 | 能改什么 |
|---|---|---|
| [大报告/原型/app.js](大报告/原型/app.js)、[index.html](大报告/原型/index.html) | 流程 / 前端主力 | 状态机、页面跳转、任务链、版本号 |
| [大报告/原型/data.js](大报告/原型/data.js) | 内容策展（电子信息） | 电子信息类课程、知识点、方向、判读关键词 |
| [大报告/原型/majors.js](大报告/原型/majors.js) | 内容策展（其他专业） | 计算机类、跨学科方向、语言路线、专业介绍文案 |
| [大报告/原型/teach.js](大报告/原型/teach.js)、[teach2.js](大报告/原型/teach2.js) | 讲解内容 | 四段式讲解（纯内容，冲突低） |
| [大报告/原型/styles.css](大报告/原型/styles.css) | 设计 | 样式；改完要看 900px / 560px 两个断点 |
| [大报告/服务/](大报告/服务/) | 服务端 | 接口、数据层；接口契约改动要同步前端 |
| [大报告/项目构想_先见_v0.md](大报告/项目构想_先见_v0.md) | 维护者 / 教育研究 | 版本日志、招募、路线图 |

分工要调整时，同步改 [.github/CODEOWNERS](.github/CODEOWNERS)，让 GitHub 自动找对人的 review。

## 4. 分支与 PR

```bash
git checkout -b feat/计划重排        # feat / fix / content / docs / design
# 改代码……
git add -A && git commit -m "feat: 做完一件后重排后面 2-3 件"
git push -u origin feat/计划重排
# 在 GitHub 开 PR，按模板写清楚三件事
```

PR 描述必须回答：**改了什么 / 我怎么自测的（桌面+手机截图）/ 影响哪些知识点或方向**。
合并前至少跑过 `npm test`，并手动走一遍「选专业 → 方向 → 勾知识点 → 做一件 → 追问」。

## 5. 版本号（防缓存）

[大报告/原型/index.html](大报告/原型/index.html) 里三个脚本/样式都带 `?v=N`（当前 `v=330`）。
**PR 作者不要改版本号**，否则多个 PR 会各 bump 一次、必然冲突。约定：

- 合并者合并后，立刻把三个 `?v=N` 统一 +1 并单独提交（`chore: bump v=331`），再推送。
- 如果同时改了几份 PR，合并完最后一个再 bump 一次即可。

## 6. 文档与生成物

- 改了 [大报告/项目构想_先见_v0.md](大报告/项目构想_先见_v0.md)，要重新生成站内企划书页：
  ```bash
  python tools/md2plan.py     # 读 大报告/项目构想_先见_v0.md → 写 大报告/原型/plan.html
  ```
  并把 `plan.html` 一起提交（它在仓库里）。
- 改版本、加功能后，同步更新构想书里「三、现在做到哪」与「十一、版本日志」。
- 一次性改写脚本、个人推送脚本不要再提交进仓库（历史在 git 里能查）。

## 7. 上线与自测

`main` 合并 → Railway 自动部署（约 2–3 分钟）。合并后按 [大报告/服务/部署.md](大报告/服务/部署.md) 末尾的信号验证：

```bash
curl -s https://xianjian-production.up.railway.app/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://xianjian-production.up.railway.app/api/progress   # 应为 401
curl -s https://xianjian-production.up.railway.app/index.html | grep -o "app.js?v=[0-9]*"           # 应是最新 v
```

部署不生效时，先看 [部署.md 的 Railway GitHub App 授权一节](大报告/服务/部署.md)，再排查代码。

## 8. 沟通

- 任务用 GitHub Issues，打 `frontend` / `content` / `llm` / `design` / `docs` 标签；一个 issue 一件事。
- 每周一次 60 分钟同步（时间在群里定），其余时间异步。
- 卡住超过半天就在群里说，不要自己憋着改大文件。

## 9. 署名

每个合并的 PR 都会出现在贡献记录里。课程报告与演示中的署名按实际贡献写；需要单独列名单时，维护者会更新 `CONTRIBUTORS.md`。
