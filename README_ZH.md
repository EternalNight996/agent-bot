<h1 align="center">
  <img src="desktop-pet/assets/whale-girl.png" width="110" alt="大肥鱼" />
  <br/>
  agent-bot
</h1>

<p align="center"><sub>AGENT-BOT · 小肥鱼</sub></p>

<h3 align="center">给 AI 团队<br/>一座会交付的洞府</h3>

<p align="center">一个 DeepSeek Harness 会话，变成一支真正交付的团队：掌教派活、依赖任务 DAG、独立审查、交付展示。还有一只会睡觉、会漫游的小肥鱼，桌面与 DSH 同步。</p>

<p align="center">
  <a href="https://github.com/EternalNight996/agent-bot/releases"><b>下载桌面宠物 ↓</b></a> ·
  <a href="https://github.com/EternalNight996/agent-bot"><b>GitHub 开源 ↗</b></a> ·
  <a href="https://www.npmjs.com/package/@eternalnight/agent-bot"><b>npm ↗</b></a>
</p>

<p align="center">
  <a href="https://github.com/EternalNight996/agent-bot/stargazers"><img src="https://img.shields.io/github/stars/EternalNight996/agent-bot?style=flat" alt="GitHub stars" /></a>&nbsp;
  <a href="https://www.npmjs.com/package/@eternalnight/agent-bot"><img src="https://img.shields.io/npm/v/@eternalnight/agent-bot?color=CB3837" alt="npm" /></a>&nbsp;
  <a href="https://github.com/EternalNight996/agent-bot/releases"><img src="https://img.shields.io/badge/release-v0.1.5-FF7A45" alt="release" /></a>&nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
</p>

<p align="center"><a href="README.md">English (default)</a> · <b>简体中文（镜像）</b></p>

| **25** | **6** | **10 分钟** | **0** |
|:---:|:---:|:---:|:---:|
| **组宠物动作** | **件可点设施** | **真实睡眠** | **云依赖** |
| 待机 / 点击 / 睡觉 / 工作 / 拖拽 / 漫游 | 山门 / 道统 / 功德碑 / 封神榜 / 天机阁 / 宗门志 | 睡着后点一下才醒，不点就继续睡 | 状态在 `.agent-teams` 与本地存档，MIT |

---

<p><sub><code>LIVE HALL · 点得动</code></sub></p>

## 真实界面，而不是概念图

下面是插件里真实的交付现场：目标怎么填、访谈怎么拍板、交付时产物怎么就地跑起来、结果怎么汇总。全部是当前版本真机画面（Windows 11 · DSH 桌面端，2026-11-05 采集），原样拷贝到 `assets/screenshots/`，**未美化、未拼接、未重绘**。

<p align="center">
  <img src="assets/screenshots/任务目标.png" width="49%" alt="组建团队第 1 步：目标、开发模式与阵容" />
  <img src="assets/screenshots/任务拍板.png" width="49%" alt="组建团队第 2 步：需求访谈选项，勾选后拍板" />
</p>
<p align="center"><sub>▲ 目标「做个贪吃蛇」· 开发模式/阵容 · 视觉爆炸 —— 需求访谈（运行环境 / 主题 / 动效强度）勾选后拍板</sub></p>

<p align="center">
  <img src="assets/screenshots/任务交付.png" width="100%" alt="交付：驱动网关内直接运行交付物，左侧是验收证据" />
</p>
<p align="center"><sub>▲ 交付时：「驱动网关」里直接跑起刚交付的产物，左侧是冒烟结果、独立验收与真实渲染证据</sub></p>

<p align="center">
  <img src="assets/screenshots/交付结果.png" width="49%" alt="交付结果：2/2 通过，0 阻断，13 分 33 秒" />
  <img src="assets/screenshots/交付demo.png" width="49%" alt="交付物本体：霓虹赛博贪吃蛇 NEON SERPENT" />
</p>
<p align="center"><sub>▲ 交付结果：2/2 通过 · 0 阻断 · 13m33s · 165.2K token · ¥1.66 —— 产物本体：NEON SERPENT</sub></p>

**一次真实交付的五个步骤：**

| 步骤 | 画面 | 发生了什么 |
| --- | --- | --- |
| 1 | `任务目标.png` | 目标写「做个贪吃蛇」，选开发模式与阵容；可选「视觉爆炸」与「复刻项目」 |
| 2 | `任务拍板.png` | AI 按目标拟需求访谈：运行环境、视觉主题、动效强度…… 勾选后 **拍板** |
| 3 | 计划审核 | 成员、任务、依赖、验收、验证命令全部先摊开，**批准前不创建任何东西** |
| 4 | `任务交付.png` | 队长派发、成员交付；驱动网关就地跑起产物，附冒烟、独立验收与渲染证据 |
| 5 | `交付结果.png` / `交付demo.png` | 团队页汇总 2/2 通过、0 阻断；产物是一份能直接玩的贪吃蛇 |

> 图内数值是这一次运行的真实记录（13m33s · 165.2K token · ¥1.66），不同任务会有差异，不是承诺。

---

<p><sub><code>THE PET · 小肥鱼</code></sub></p>

## 会睡觉、会漫游，也会醒来干活

桌面端和 DSH 端共享同一套角色资源；桌面端是独立安装包，DSH 端收起后就是同一只宠物的令牌。透明、置顶、可拖动，窗口里只有角色本体。

<p align="center">
  <img src="assets/screenshots/pet-main.png" width="32%" alt="桌面宠物主界面" />
  <img src="assets/screenshots/pet-first-launch.png" width="32%" alt="首次启动" />
  <img src="assets/screenshots/pet-token.png" width="32%" alt="收起右侧栏后的可拖令牌" />
</p>
<p align="center"><sub>▲ 主界面（只有角色本体） · 首次启动 · 收起右侧栏后的可拖令牌</sub></p>

<p align="center">
  <img src="assets/screenshots/pet-behaviors.png" width="86%" alt="动作总览：点击回应 / 睡觉 / 工作 / 拖拽 / 待机变体" />
</p>
<p align="center"><sub>▲ 五格依次为 点击回应 · 睡觉 · 工作 · 拖拽 · 待机变体</sub></p>

<p>→ 25 组动作：点击回应、睡觉链路、6 种工作状态、拖拽反馈、随机待机<br/>
→ 空闲 18–28 秒小跑一段，停下再随机换动作<br/>
→ 睡觉持续 10 分钟；不点就一直睡，点一下才醒<br/>
→ 双击唤出 DSH 并展开右侧福地；DSH 没开就自动启动</p>

<p align="center"><sub><code>IDLE / FEED / SLEEP / WORK / DRAG · REAL FRAMES · MIT</code></sub></p>

---

<p><sub><code>WHY IT IS DIFFERENT</code></sub></p>

## 不是又一个智能体仪表盘

常见智能体 UI 给你一墙日志。这里给你一个地方：谁在干活、什么卡住了、交付了什么，都写在同一个地方。

| 支柱 | 说明 |
| --- | --- |
| **A HALL, NOT A DASHBOARD**<br/>**01 不是仪表盘，是一座洞府** | 六件可点设施、会动的场景、能展开的右侧栏。点修士进对话，点令牌展开福地；任务、审查和交付都在同一个地方发生。 |
| **DELIVERY, NOT VIBES**<br/>**02 交付有门禁，不靠气氛** | 任务 DAG、写域、验收命令、独立审查；实现者不能批准自己的实现。完成不是一句“做完了”，而是宿主复跑命令、审查给出 pass。 |
| **ONE PET, TWO PLACES**<br/>**03 桌面与 DSH，同一只小肥鱼** | 真实的逐帧动作：随机待机、18–28 秒漫游、点击回应、10 分钟睡眠。DSH 收起入口是同一只宠物的动画版本。 |

---

<p><sub><code>STILLS · 剧照</code></sub></p>

## 静图看细节

洞府和宠物在页面上就能看，截图只留几张补细节。点任意一张放大。

<p align="center">
  <a href="assets/screenshots/任务目标.png"><img src="assets/screenshots/任务目标.png" width="32%" alt="目标与阵容" /></a>
  <a href="assets/screenshots/交付demo.png"><img src="assets/screenshots/交付demo.png" width="32%" alt="交付产物" /></a>
  <a href="assets/screenshots/pet-behaviors.png"><img src="assets/screenshots/pet-behaviors.png" width="32%" alt="动作帧" /></a>
</p>
<p align="center"><sub>▲ DSH 里的开宗向导 · 交付产物 · 25 组动作帧</sub></p>

<p align="center"><a href="https://github.com/EternalNight996/agent-bot"><b>打开 GitHub 仓库 →</b></a></p>

---

<p><sub><code>UNDER THE PIXELS</code></sub></p>

## 洞府下面是真团队运行时

<p>→ 掌教带队的任务 DAG，依赖满足才派发<br/>
→ 持久成员会话、邮箱、attempt 所有权<br/>
→ 质量契约：目标 / 范围 / 验收 / 验证命令 / 审查结论<br/>
→ 独立审查门禁、修复轮次、冷恢复<br/>
→ 每个角色独立写域，前端 / 后端 / 合契互不重叠</p>

```text
.agent-teams/<teamId>/
  team.json
  inbox/
  delivery-report.md
# 本地优先；不接云账号
```

<p align="center"><sub><code>WORKSPACE STATE · MIT</code></sub></p>

---

<p><sub><code>QUICK START</code></sub></p>

## 一条命令，开宗立派

装完即用：开宗向导、计划审核、右侧福地和持久团队都会就绪。桌面宠物单独安装，不依赖 Python 环境。

**DeepSeek Harness**

```powershell
dsh plugin --profile desktop add @eternalnight/agent-bot
# 重开 DSH → 组建团队
```

**桌面宠物安装包**

```powershell
DSH-Pet-Setup-<version>.exe
# 按用户安装到 %LOCALAPPDATA%\Programs\DSH Pet，创建桌面快捷方式
# 最近发布的宠物包见 GitHub Releases
```

**从 GitHub 安装**

```powershell
git clone https://github.com/EternalNight996/agent-bot
dsh plugin --profile desktop add ./agent-bot
```

安装后最小闭环：点 **组建团队** → 填目标与阵容 → 访谈勾选并 **拍板** → **先审计划再批准** → 看成员跑、交付时在驱动网关里直接看产物。

从源码跑宠物：

```powershell
.\desktop-pet\start-pet.cmd
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" desktop-pet\pet.py --workspace .
python desktop-pet\pet.py --check --workspace .
```

> 主流程已实跑（2026-11-05）：`pet.py --check --workspace .` 退出码 0，输出 `{"ok": true, "level": 2, "stage": "fry", "frames": 16, ...}`（`completedTasks` 随任务完成数变化，不写死）。

---

<p><sub><code>DELIVERY GATES</code></sub></p>

## 交付门禁

| 信号 | 证据 |
| --- | --- |
| 全量套件 | `pnpm verify` 退出码 0 |
| 浏览器侧契约 | `pnpm verify:web-routes` 通过 |
| 发布产物 | 包冒烟检查运行时与支持二维码，排除源码 / 测试 / 文档 |
| 真实团队跑 | 队长派发 → 成员写入 → 独立审查 → 汇总（由全量套件覆盖） |
| 隔离 | 实现者不能批准自己的实现 |

这是给**并行墙钟 + 独立验证**用的工具，不是「每个任务都更便宜」的承诺；小任务通常一个智能体更划算。

### 质量门禁配置

字段 `quality` 控制门禁如何审计：

| 选项 | 默认 | 作用 |
| --- | --- | --- |
| `autoVerify` | `true` | 宿主在接收完成的质检任务前，复跑每条声明的 `verify` 命令 |
| `autoReview` | `false` | 所有门禁、目标验收与宿主命令通过后，自动完成就绪的审查任务 |
| `requireAcceptance` | `true` | 自动审查要求被审任务的每条验收都通过 |
| `autoDetect` | `true` | 检测生成项目自带的 `package.json` 测试 / 类型检查脚本并一起跑 |
| `reviewMode` | `"auto"` | `auto`：宿主收口；`human`：宿主审完停在「待人工复核」 |
| `commands` | `["git diff --check"]` | 生成项目的兜底验证命令，不继承插件脚本 |
| `commandsByProject` | `{}` | 按项目根目录配置验证命令 |
| `verifyTimeoutMs` | `120000` | 每条验证命令的宿主超时 |

```yaml
quality:
  autoReview: true
  reviewMode: "human"   # 宿主审核通过后停在「待人工复核」
  commandsByProject:
    "projects/贪吃蛇": ["node projects/贪吃蛇/smoke.mjs"]
```

---

<p><sub><code>ROLES &amp; TEMPLATES</code></sub></p>

## 角色与模板

阵容按「接下来要干什么」组队，席位上限 5，空闲角色不消耗 token。下面是内置的 6 套任务阵容（定义在 `src/client/lineup-store.ts`，角色显示名取自 `src/agency-role-seeds.ts`）：

| 阵容 | 角色（id → 显示名） | 适合 |
| --- | --- | --- |
| **功能直交** | `product-manager` 产品经理（PM） · `engineering-senior-developer` 高级开发者 · `testing-evidence-collector` 证据收集者 · `engineering-code-reviewer` 代码审查员 | 少绕弯，功能直接抵达任务 |
| **缺陷修复** | `engineering-codebase-onboarding-engineer` 代码库入职引导工程师 · `engineering-senior-developer` 高级开发者 · `testing-evidence-collector` 证据收集者 | 先摸清代码，再定位并修 |
| **全栈功能** | `product-manager` 产品经理（PM） · `engineering-frontend-developer` 前端开发者 · `engineering-backend-architect` 后端架构师 · `testing-evidence-collector` 证据收集者 · `engineering-code-reviewer` 代码审查员 | 契约先行，前后端并行（满 5 席） |
| **只读审计** | `engineering-codebase-onboarding-engineer` 代码库入职引导工程师 · `engineering-code-reviewer` 代码审查员 · `testing-evidence-collector` 证据收集者 · `engineering-technical-writer` 技术文档工程师 | 不动工作区，只取证 |
| **性能压测** | `product-manager` 产品经理（PM） · `engineering-senior-developer` 高级开发者 · `testing-performance-benchmarker` 性能基准师 · `engineering-devops-automator` DevOps 自动化师 | 指标先行，压测结论有数据支撑 |
| **安全合规** | `security-appsec-engineer` 应用安全工程师 · `security-cloud-security-architect` 云安全架构师 · `engineering-devops-automator` DevOps 自动化师 · `testing-evidence-collector` 证据收集者 | 先复现再修，最小 diff |

另有按开发模式生成的 6 套预设阵容（如「快速体验阵容」「标准交付阵容」），以及组建向导里的 12 个任务模板：**功能直交 / 修 Bug / 新功能 / 调研 / 审计 / 全栈交付 / 加固交付 / 构建交付 / 重构交付 / 文档交付 / 方案评审 / 短剧制作**。

每个角色拿到固定契约：归属、必须做 / 不能做、完成标准、五条要点汇报与工作量预算。全栈阵容刻意保持 5 席：少一次交接。

---

<p><sub><code>BOUNDARIES</code></sub></p>

## 边界

- 没有隐藏的云同步：养成与反馈诊断都留在本地。
- 批准是显式的：计划草案在你批准前不会启动。
- 部署需要明确确认：智能体不会悄悄替换正在运行的会话。
- 审查是独立的：实现者不能批准自己的实现。

---

<p><sub><code>DEVELOPMENT</code></sub></p>

## 开发

```powershell
pnpm install
pnpm typecheck
pnpm build
pnpm verify
pnpm verify:web-routes
```

新克隆后先 `pnpm build` 再 `pnpm verify`：`lib/client/` 的构建中间产物与 `*.map` 是生成物，不入库。DSH 生命周期技能从共享记忆库实时解析，不在本仓内置。

---

<p align="center"><b>如果这座洞府让你的智能体更好用</b><br/>点一个 Star，让更多被「智能体团队没有界面、交付没有证据」困扰的人找到它。</p>

<p align="center">
  <a href="https://github.com/EternalNight996/agent-bot/stargazers"><b>⭐ Star on GitHub →</b></a> ·
  <a href="https://github.com/EternalNight996/agent-bot/releases"><b>下载桌面宠物</b></a> ·
  <a href="https://www.npmjs.com/package/@eternalnight/agent-bot"><b>npm 安装</b></a>
</p>

---

<p><sub><code>COMMUNITY</code></sub></p>

## 交流群

| QQ 群 | 微信群 |
|:---:|:---:|
| <img src="assets/support/group-qr.jpg" width="240" alt="QQ 群二维码" /> | <img src="assets/support/group-wechat.jpg" width="240" alt="微信群二维码" /> |

**请作者喝杯咖啡（可选）：**

| 微信支付 | 微信赞赏 |
|:---:|:---:|
| <img src="assets/support/wechat-pay.jpg" width="200" alt="微信支付码" /> | <img src="assets/support/wechat-reward.jpg" width="200" alt="微信赞赏码" /> |

> 赞助完全可选，不影响功能与许可，插件保持 MIT 免费。详见 [SPONSOR.md](SPONSOR.md)。

## 许可与链接

MIT © 2026 惠州市梦游科技有限公司。授权与声明见 [NOTICE.md](NOTICE.md) 与 [LICENSE](LICENSE)。右侧栏面板 UI、交付治理层与桌面宠物均为本项目原创。

- [CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · [compatibility.json](compatibility.json) · [IP 与署名](NOTICE.md)
- Issues：https://github.com/EternalNight996/agent-bot/issues · Releases：https://github.com/EternalNight996/agent-bot/releases · 官网：http://180.76.144.48/agent-bot
