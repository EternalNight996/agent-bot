<h1 align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/app-icons/desktop/png/app-128.png" width="56" alt="dsh-super-agents 图标" />
  <br/>
  dsh-super-agents
</h1>

<p align="center"><b>你的智能体不需要又一个仪表盘。<br/>它们需要一个地方干活。</b></p>

<p align="center"><sub>常驻在 DeepSeek Harness 右侧栏的像素宗门——你批准计划，掌教带一队专精修士把活干完，再把产物直接摊开给你看。</sub></p>

<p align="center">
  <a href="https://github.com/EternalNight996/dsh-super-agents/stargazers"><img src="https://img.shields.io/github/stars/EternalNight996/dsh-super-agents?style=flat" alt="GitHub stars" /></a>
  <a href="https://www.npmjs.com/package/dsh-super-agents"><img src="https://img.shields.io/npm/v/dsh-super-agents?color=CB3837" alt="npm version" /></a>
  <a href="https://github.com/EternalNight996/dsh-super-agents/releases"><img src="https://img.shields.io/badge/release-v0.1.150-FF7A45" alt="release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-Web%20%2B%20Headless-5B4CF0" alt="DSH" /></a>
</p>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b></p>

<p align="center">
  <a href="https://github.com/EternalNight996/dsh-super-agents"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/social-preview.webp" width="100%" alt="dsh-super-agent — 给 AI 团队的像素修仙洞府" /></a>
</p>

<p align="center"><b>开宗 → 审计划 → 批准 → 看洞府跑起来。</b></p>

<p align="center"><b>▶ <a href="http://180.76.144.48/dsh-super-agent">在线展示页</a></b> &nbsp;·&nbsp; 下面是真实 DSH 会话截图</p>

<p align="center"><strong>⭐ 如果这就是你一直想要的智能体界面，点一个 Star——这座洞府靠它继续长大。</strong></p>

## 🎬 真实会话，不是示意图

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/plan-review.webp" width="49%" alt="执行前计划审查" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/progress.webp" width="49%" alt="任务进度与洞府实况" />
</p>
<p align="center"><sub><b>先审后跑</b> —— 3 名修士、3 项任务、2 条依赖；确认草案后才创建与调度。 &nbsp;·&nbsp; <b>实时任务 DAG</b> —— 掌教派发 t1，毒修等 t1，体修等 t2。</sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/equipment.webp" width="100%" alt="天机阁装备与坐骑" />
</p>
<p align="center"><sub><b>装备真的会画出来</b> —— 换上飞剑，掌教就御剑而行；法器、坐骑、技能按境界解锁。</sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/dao-rules.webp" width="32%" alt="道统与名册配置" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/ranks.webp" width="32%" alt="封神榜十五重境界" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/roster.webp" width="32%" alt="山门名册与已完成任务" />
</p>
<p align="center"><sub><b>一支小宗门</b> —— 角色、境界、模型一眼看清。 &nbsp;·&nbsp; <b>十五重境界</b> —— 从凡人到道祖。 &nbsp;·&nbsp; <b>历史留名</b> —— 已完成任务与下一次开宗。</sub></p>

## 🐉 这是什么？

**dsh-super-agents** 把 DeepSeek Harness 的一个会话变成一间真正干活的宗门。你批准计划，掌教把它拆成带依赖的任务 DAG，各专精修士按固定契约交付。洞府常驻右侧栏，永远只差一次点击——收起后就变成一枚可拖到任意角落的令牌。

像素下面是一层交付治理，不是聊天皮肤：

- **先审后跑**——成员、任务、依赖与验收都确认后才创建、才派发；
- 持久成员会话、依赖感知派发、邮箱、重试、冷恢复、attempt 所有权；
- **质量契约**（目标 / 范围 / 验收 / 验证）由宿主复跑命令，外加独立审查门禁——实现者不能批准自己的实现；
- 按任务记账的真实成本、交付报告，以及把产物直接在面板里打开的「交付展示」；
- 宗门状态在 `.agent-teams/`，就在你的工作区；本地优先、MIT、不需要云账号。

**开一个宗门，给它一个目标，批准计划，看洞府跑起来——最后让它把交付摊开给你看。**

## 🆚 不是又一个智能体仪表盘

|  | 常见智能体 UI | dsh-super-agents |
|---|---|---|
| 谁在干活 | 日志行 | 坐在案前的修士 |
| 什么卡住了 | 状态文字 | 功德碑 + 依赖边 |
| 审查 | 可选 | 独立门禁 |
| 进度 | 一个百分比 | 十五重境界、装备、坐骑 |
| 状态 | 云账号 | 你的工作区，本地优先 |
| 好玩 | 无 | 说实话，挺多 |

## ✨ 为什么值得一个 Star

- 🏯 **洞府就在对话旁边** —— 宗门常驻右侧栏，不盖住对话；收起成令牌可拖到任意角落，点一下就回来——切到还没有宗门的对话也仍有入口。
- ⏹ **输入区直接叫停换任务** —— 当前任务卡在长任务后面时，一个按钮中断在跑的任务、立刻开始下一条 ready 任务；3 秒内二次点击才执行，不误触。
- 🧠 **真团队协议** —— 持久子智能体、依赖感知派发、邮箱、重试、冷恢复、attempt 所有权。不是演示壳子。
- 🧾 **交付，不靠感觉** —— 质量契约、宿主复跑每条 verify 命令、独立审查门禁：实现者不能批准自己的实现。
- 🖥 **交付展示** —— 任务交付后藏经阁直接打开产物：页面在面板里运行、图片直接看、源码可读；不用自己装依赖、开服务、跑命令。
- 🌱 **看得见的修炼** —— 任务与挂机喂养全宗共享的十五重境界；法器、坐骑、技能直接画进洞府；跨境界时破境特效停留更久。
- 📜 **封神榜 + 宗门志** —— 本宗留名、境界谱、修为卡、赞助/交流群/关于/反馈，一个面板收齐。
- 🔒 **本地优先 & MIT** —— 宗门状态在你的工作区；没有云账号、没有隐藏同步。一条命令，Web + Headless。

## ⚡ 快速开始

**DeepSeek Harness（桌面 / Web）**

    dsh plugin --profile desktop add dsh-super-agents
    # 重开 DSH —— 洞府已经在右侧栏等你

然后：

1. 点 **开宗立派**（或把洞府收成令牌再点令牌）——向导会问目标（含可选视觉爆炸开关与复刻项目）、道统、需求与宗门。
2. 审核 staged 计划——成员、任务、依赖、验收——然后批准；批准前不会创建任何修士、也不派发。
3. 看洞府跑起来：点修士进对话、点等级牌换装备，交付后在 **藏经阁 → 展示** 里直接看产物，不用跑命令。

**从 GitHub 安装**

    git clone https://github.com/EternalNight996/dsh-super-agents
    dsh plugin --profile desktop add ./dsh-super-agents

**GitHub 很慢时（网络受限）**

git 智能协议常被限速，即使普通 HTTPS 下载正常，`git clone` / `pnpm add github:…` 也会一直卡住。`--registry=<镜像>` 只改 npm 源，不会代理 GitHub。改用下面任一方式：

    # a) 从 Release 用普通 HTTPS 下载构建好的 tgz
    #    https://github.com/EternalNight996/dsh-super-agents/releases
    dsh plugin --profile desktop add ./dsh-super-agents-<版本>.tgz

    # b) 安装已发布的 npm 版本（npmmirror 等镜像可用）
    dsh plugin --profile desktop add dsh-super-agents@0.1.138

插件必须装进 DSH profile，不要用裸 `pnpm add <github-url>`。

**CLI / Headless**

    dsh --profile desktop
    # 直接说：用 AgentTeams 开一个团队做 …

当前版本 **0.1.150**。推荐宿主：DeepSeek Harness **0.2.1-rc.5**（Web + Headless）。精确矩阵见 [compatibility.json](compatibility.json)。

想先看效果？**[打开梦游官网的在线展示页](http://180.76.144.48/dsh-super-agent)**。

## 🏯 洞府里有什么

| 设施 | 作用 |
|---|---|
| **山门 · 名册** | 当前宗门、历史宗门与团队入口 |
| **藏经阁 · 道统** | 成员、任务契约、开宗草案与向导；交付完成后「展示」直接预览产物 |
| **功德碑 · 进度** | 任务依赖、派发进度、验证证据 |
| **封神榜** | 本宗留名、十五重境界、修为卡、升级提示、宗门故事 |
| **天机阁** | 法器 / 坐骑 / 技能物品栏，选择后洞府即时预览 |
| **宗门志** | 赞助、交流群、关于、隐私受限的反馈表单 |
| **收件** | 掌教收件箱，键盘可达、文本转义 |

墙面和底栏是同一套面板的两个入口。收起洞府会变成一枚可拖动的令牌，点令牌把右侧栏洞府叫回来。单击修士进入对话；单击头顶等级牌打开装备。

## 🧠 像素下面

- 掌教带队的任务 DAG，依赖满足才派发；
- 持久成员会话、邮箱、attempt 所有权；
- 质量契约：目标、范围、验收、验证命令、审查结论；
- 独立验证/审查门禁、修复轮次、冷恢复；
- 每个角色有独立写入边界，前端/后端/合契互不重叠；
- 宗门状态在 `.agent-teams/<teamId>/`——可查、本地、属于你。

## 🧩 角色与模板

| 模板 | 默认角色 | 适合 |
|---|---|---|
| **全栈** | 合契师 · 灵绘师 · 地脉师 · 验证 · 审查 | 契约先行、前后端并行 |
| **安全加固** | 巡查使 · 镇魔师 · 验证 · 审查 | 先复现、最小修复、残余风险 |
| **只读审计 / 巡查** | 巡查使 · 审查 | 只读取证、不改工作区 |
| **修 Bug / 新功能 / 调研 / 构建 / 文档 / 论道** | 小规模角色组 | 日常团队任务 |
| **架构重构** | 阵法师 · 实现 · 验证 · 审查 | 边界与迁移 |

每个专业角色都有固定契约：ownership、must / must not、done、五条 Report、Working budget。全栈刻意压到五人：合契师同时拥有契约与最终联调，少一次交接。

## 🧾 交付，不靠感觉

| 信号 | 证据 |
|---|---|
| 全量测试 | **pnpm verify** exit 0 |
| 浏览器侧契约 | **pnpm verify:web-routes** 通过 |
| 发布产物 | package smoke 检查运行时 + 支持二维码，排除源码/测试/文档 |
| 真实团队运行 | 掌教派发 → 成员写文件 → 独立审查 → 汇总（由全量测试覆盖） |
| 隔离 | 实现者不能批准自己的实现 |

这是一个追求**并行墙钟 + 独立验证**的工具，不承诺所有任务更省 token。小任务通常单 agent 更合适。

## ⚙️ 质量门禁配置

插件配置里的 `quality` 字段控制审核方式：

| 选项 | 默认 | 作用 |
|---|---|---|
| `autoVerify` | `true` | 完成任务前，宿主重新执行任务声明的 `verify` 命令 |
| `autoReview` | `false` | 当所有门禁、实现验收与宿主命令都通过后，宿主自动完成待审查任务 |
| `requireAcceptance` | `true` | 自动审核要求被审实现的每条验收都通过 |
| `autoDetect` | `true` | 自动探测产物目录 `package.json` 的 test/typecheck 脚本，纳入宿主验证 |
| `reviewMode` | `"auto"` | `auto`：宿主直接完成审查；`human`：宿主审核通过后停在「待人工复核」，由人在藏经阁点「确认复核」 |
| `commands` | `["git diff --check"]` | 生成项目的兜底验证命令；不再继承插件自身的脚本 |
| `commandsByProject` | `{}` | 按产物根配置验证命令，如 `"projects/贪吃蛇": ["node projects/贪吃蛇/smoke.mjs"]` |
| `verifyTimeoutMs` | `120000` | 宿主执行每条验证命令的超时 |

每个字段都可单独省略，省略即用默认值（整个 `quality` 不写则全部用默认行为）。

```yaml
quality:
  autoReview: true
  reviewMode: "human"   # 宿主审核通过后停在「待人工复核」
  commandsByProject:
    "projects/贪吃蛇": ["node projects/贪吃蛇/smoke.mjs"]
```

## 🛡️ 边界

- 不做隐藏云同步：修炼与反馈诊断都留在本地。
- 批准才开工：staged 计划必须由你批准。
- 部署必须显式确认；智能体不会静默替换正在运行的宗门。
- 审查独立：实现者不能批准自己的实现。

## 🗺️ 路线图

- [ ] 更多宗门与角色模板；
- [ ] 更深的装备、坐骑、技能特效；
- [ ] 桌面 / Web / iOS / Android 原生图标集（桌面 PNG 梯度 + 1024 母版已就绪，移动端/Web 按需从母版生成）；
- [ ] 更多文档与翻译；
- [ ] 你的想法——欢迎开 issue。

## 🧑‍💻 开发

    pnpm install
    pnpm typecheck
    pnpm build
    pnpm verify
    pnpm verify:web-routes

新克隆请先 `pnpm build` 再 `pnpm verify`：`lib/client/` 构建中间产物与 `*.map` 为生成物、不入库。DSH 生命周期技能从共享记忆库实时获取，本仓库不再内置副本。

入口：[CONTRIBUTING.md](CONTRIBUTING.md)、[CHANGELOG.md](CHANGELOG.md)、[compatibility.json](compatibility.json)、[IP 与归属](NOTICE.md)。

应用图标在 `assets/app-icons/desktop/png/`（16–512 梯度 + 1024 母版）与 `assets/app-icons/desktop/app.ico`；插件同时携带 `assets/zhulong.ico` 与 `assets/zhulong-icon.png` 供应用打包使用，移动端与 Web 图标在发版时从 1024 母版生成。

## 💬 交流群 & 赞助

**有问题、想法，或想聊 DSH 插件——扫码进 QQ / 微信交流群：**

| QQ 交流群 | 微信交流群 |
|:---:|:---:|
| <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-qr.jpg" target="_blank" rel="noreferrer" title="点击放大"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-qr.jpg" width="220" alt="QQ 交流群二维码" /></a> | <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-wechat.jpg" target="_blank" rel="noreferrer" title="点击放大"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-wechat.jpg" width="220" alt="微信交流群二维码" /></a> |

**请作者喝杯咖啡（完全自愿）：**

| 微信收款码 | 微信赞赏码 |
|:---:|:---:|
| <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-pay.jpg" target="_blank" rel="noreferrer" title="点击放大"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-pay.jpg" width="200" alt="微信收款码" /></a> | <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-reward.jpg" target="_blank" rel="noreferrer" title="点击放大"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-reward.jpg" width="200" alt="微信赞赏码" /></a> |

> 赞助完全自愿，不影响任何功能；插件本体始终开源免费（MIT）。见 [SPONSOR.md](SPONSOR.md)。

- Issues：https://github.com/EternalNight996/dsh-super-agents/issues
- 由 **惠州市梦游科技有限公司** 维护与发布。

## 📄 许可

MIT © 2026 惠州市梦游科技有限公司。归属与许可全文见 [NOTICE.md](NOTICE.md) 与 [LICENSE](LICENSE)。像素洞府、修炼体系、装备、封神榜与宗门志为本项目原创。

<p align="center"><strong>⭐ 想让这座洞府继续长大，就点一个 Star。</strong></p>
