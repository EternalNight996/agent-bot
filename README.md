<h1 align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/app-icons/desktop/png/app-128.png" width="56" alt="dsh-super-agents icon" />
  <br/>
  dsh-super-agents
</h1>

<p align="center"><b>Your agents don't need another dashboard.<br/>They need a place to work.</b></p>

<p align="center"><sub>A permanent pixel sect in your DeepSeek Harness sidebar — approve the plan, and a captain with a real roster ships the work, then shows it to you in place.</sub></p>

<p align="center">
  <a href="https://github.com/EternalNight996/dsh-super-agents/stargazers"><img src="https://img.shields.io/github/stars/EternalNight996/dsh-super-agents?style=flat" alt="GitHub stars" /></a>
  <a href="https://www.npmjs.com/package/dsh-super-agents"><img src="https://img.shields.io/npm/v/dsh-super-agents?color=CB3837" alt="npm version" /></a>
  <a href="https://github.com/EternalNight996/dsh-super-agents/releases"><img src="https://img.shields.io/badge/release-v0.1.187-FF7A45" alt="release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-Web%20%2B%20Headless-5B4CF0" alt="DSH" /></a>
</p>

<p align="center"><b>English (default)</b> · <a href="README_ZH.md">简体中文</a></p>

<p align="center">
  <a href="https://github.com/EternalNight996/dsh-super-agents"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/social-preview.webp" width="100%" alt="dsh-super-agent — a pixel cultivation hall for AI agent teams" /></a>
</p>

<p align="center"><b>开宗 → review the plan → approve → watch the hall run.</b></p>

<p align="center"><b>▶ <a href="http://180.76.144.48/en/dsh-super-agent">Live product page</a></b> &nbsp;·&nbsp; real DSH session screenshots below</p>

<p align="center"><strong>⭐ If this is the agent UI you wanted to exist, star it — that's how the hall keeps growing.</strong></p>

## 🎬 A real session, not a mockup

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/plan-review.webp" width="49%" alt="Plan review before any member spawns" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/progress.webp" width="49%" alt="Task DAG and the pixel hall" />
</p>
<p align="center"><sub><b>Approve before spawn</b> — 3 members, 3 tasks, 2 dependencies; nothing starts until you confirm. &nbsp;·&nbsp; <b>Live task DAG</b> — the captain dispatches t1; 毒修 waits for t1, 体修 waits for t2.</sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/equipment.webp" width="100%" alt="Gear and mounts in the hall" />
</p>
<p align="center"><sub><b>Gear that shows up</b> — equip a flying sword and the captain actually rides it; artifacts, mounts and skills unlock by realm.</sub></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/dao-rules.webp" width="32%" alt="Doctrine and roster configuration" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/ranks.webp" width="32%" alt="15-realm cultivation leaderboard" />
  <img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/readme/roster.webp" width="32%" alt="Sect roster and completed tasks" />
</p>
<p align="center"><sub><b>One sect, three cultivators</b> — role, realm, model at a glance. &nbsp;·&nbsp; <b>15 realms</b> — 凡人 to 道祖. &nbsp;·&nbsp; <b>History</b> — completed tasks and the next 开宗.</sub></p>

## 🐉 What is this?

**dsh-super-agents** turns a DeepSeek Harness session into a working sect. You approve a plan; a captain splits it into a dependency-aware task DAG; specialists with fixed contracts ship it. The hall lives in the right sidebar and stays one click away — collapse it and it becomes a token you can drag anywhere.

Under the pixels it is a delivery governance layer, not a chat skin:

- **staged plans** — nothing spawns until you approve the roster, tasks, dependencies and acceptance;
- durable member sessions, dependency-aware dispatch, mailbox, retries, cold recovery and attempt ownership;
- **quality contracts** (objective / scope / acceptance / verify) with host re-run commands and an independent reviewer gate — implementers cannot approve their own work;
- real cost accounting per task, a delivery report, and a showcase that opens the shipped artifact in place;
- team state under `.agent-teams/` in your workspace; local-first, MIT, no cloud account.

**Found a sect, hand it a goal, approve the plan, watch the hall run — then let it show you the delivery.**

## 🆚 Not another agent dashboard

|  | Typical agent UI | dsh-super-agents |
|---|---|---|
| Who is working | log rows | cultivators at their desks |
| What is blocked | status text | merit stele + dependency edges |
| Review | optional | independent gate |
| Progress | a percentage | 15 realms, gear and mounts |
| State | a cloud account | your workspace, local-first |
| Fun | none | honestly, a lot |

## ✨ Why you'll love it

- 🏯 **A hall that lives beside your chat** — the sect sits in the right sidebar, not over your conversation. Collapse it to a token, drag the token anywhere, click it to bring the hall back — even from a conversation that has no sect yet.
- ⏹ **Stop-and-run-now from the composer** — when a task is stuck behind a long-running one, one button preempts the current task and starts the next ready one. Two clicks within three seconds, nothing lost.
- 🧠 **Real team protocol** — persistent subagents, dependency-aware dispatch, mailbox, retries, cold recovery and attempt ownership. Not a demo shell.
- 🧾 **Delivery, not vibes** — quality contracts, host re-run of every verify command, and an independent reviewer gate: implementers cannot approve their own work.
- 🖥 **Delivery showcase** — when work ships, the library opens the artifacts in place: pages run inside the panel, images render directly, source is readable. No installing, no starting a server, no commands to run yourself.
- 🌱 **Cultivation that shows up** — tasks and idle time feed a shared 15-realm ladder; gear, mounts and skills are drawn into the hall; crossing a realm gets a longer breakthrough effect.
- 📜 **封神榜 + 宗门志** — a sect roll, realm ladder, cultivation card, support/community/about and feedback in one place.
- 🔒 **Local-first & MIT** — team state lives in your workspace. No cloud account, no hidden sync. One command, web + headless.

## ⚡ Quick start

**DeepSeek Harness (desktop / web)**

    dsh plugin --profile desktop add dsh-super-agents
    # reopen DSH — the hall is waiting in the right sidebar

Then:

1. Click **开宗立派** — or collapse the hall to its token and click it. The founding wizard asks for the goal (with an optional 视觉爆炸 toggle and 复刻项目), doctrine, requirements and sect.
2. Review the staged plan — members, tasks, dependencies, acceptance — and approve it. Nothing spawns before that.
3. Watch the hall run. Click a cultivator to open their conversation, click a level badge to equip gear, and open **藏经阁 → 展示** to see the delivered artifact in place — no commands to run.

**From GitHub**

    git clone https://github.com/EternalNight996/dsh-super-agents
    dsh plugin --profile desktop add ./dsh-super-agents

**If GitHub git is slow (restricted networks)**

Git's smart protocol is often throttled even when plain HTTPS downloads are fine, so `git clone` / `pnpm add github:…` can appear to hang. `--registry=<mirror>` only changes the npm registry; it does not proxy GitHub. Use one of these instead:

    # a) the released tarball, downloaded over plain HTTPS from
    #    https://github.com/EternalNight996/dsh-super-agents/releases
    dsh plugin --profile desktop add ./dsh-super-agents-<version>.tgz

    # b) a published npm version (mirrors such as npmmirror work)
    dsh plugin --profile desktop add dsh-super-agents@0.1.138

Do not use bare `pnpm add <github-url>` for this plugin: a DSH plugin must be installed into a DSH profile.

**CLI / headless**

    dsh --profile desktop
    # ask: 用 AgentTeams 开一个团队做 …

Package version **0.1.187**. Recommended host: DeepSeek Harness **0.2.1-rc.5** (web + headless). Exact matrix: [compatibility.json](compatibility.json).

Prefer to look first? **[Open the live product page](http://180.76.144.48/en/dsh-super-agent)** on the Mengyou website.

## 🏯 The hall

| Facility | What it does |
|---|---|
| **山门 · 名册** | current sect, roster history and team entries |
| **藏经阁 · 道统** | members, task contracts, staged plans, founding wizard; the 展示 button previews delivered artifacts |
| **功德碑 · 进度** | task dependencies, dispatch progress, verification evidence |
| **封神榜** | sect roll, 15 realms, cultivation card, leveling tips, sect story |
| **天机阁** | equipment inventory: artifact / mount / skill, immediate hall preview |
| **宗门志** | support, community, about and a privacy-bounded feedback form |
| **收件** | captain inbox, keyboard reachable and text-escaped |

The wall and the floor bar are two routes into the same panels. Collapse the hall and it becomes a draggable token; click the token to bring the right-sidebar hall back. Click a cultivator to open their conversation; click their level badge to open gear.

## 🧠 Under the pixels

- captain-led task DAG with dependency-aware dispatch;
- persistent member sessions, mailbox and attempt ownership;
- quality contracts: objective, scope, acceptance, verify, review verdict;
- independent verifier/reviewer gates, repair rounds and cold recovery;
- per-role contracts that keep frontend/backend/integrator work in disjoint layers;
- team state under `.agent-teams/<teamId>/` — inspectable, local, yours.

## 🧩 Roles & templates

| Template | Default roles | Best for |
|---|---|---|
| **Full stack** | integrator · frontend · backend · verifier · reviewer | contract-first features; parallel layers |
| **Security hardening** | auditor · security · verifier · reviewer | repro-before-fix, minimal diff, residual risk |
| **Read-only audit** | auditor · reviewer | evidence gathering without touching the workspace |
| **Fix / feature / research / build / docs / debate** | small role sets | everyday team work |
| **Architecture** | architect · implementer · verifier · reviewer | boundaries and migrations |

Each specialist gets a fixed contract: ownership, must / must not, done, five-bullet report, and a working budget. The full-stack team is intentionally five people: the integrator owns both the contract and final integration, cutting one handoff.

## 🧾 Delivery, not vibes

| Signal | Evidence |
|---|---|
| Full suite | **pnpm verify** exit 0 |
| Browser-side contracts | **pnpm verify:web-routes** pass |
| Publish artifact | package smoke checks runtime + support QRs, excludes source/tests/docs |
| Real team run | captain dispatch → member writes → independent review → summary (exercised by the full suite) |
| Isolation | implementers cannot approve their own implementation |

This is a tool for **parallel wall-clock + independent verification**, not a promise that every task gets cheaper. Small tasks are usually better with one agent.

## ⚙️ Quality gate configuration

The plugin config field `quality` controls how gates are audited:

| Option | Default | Effect |
|---|---|---|
| `autoVerify` | `true` | The host re-runs every declared `verify` command before accepting a completed quality task |
| `autoReview` | `false` | The host auto-completes ready review tasks after all gates, the target acceptance and host commands pass |
| `requireAcceptance` | `true` | Auto review requires every acceptance item of the reviewed task to pass |
| `autoDetect` | `true` | Detect the generated project's own `package.json` test/typecheck script and run it with the host verify |
| `reviewMode` | `"auto"` | `auto`: host closes the review; `human`: host audits then waits for a human "Confirm review" click in 藏经阁 |
| `commands` | `["git diff --check"]` | Fallback verify commands for generated projects; plugin scripts are never inherited |
| `commandsByProject` | `{}` | Per-product verify commands keyed by root, e.g. `"projects/snake": ["node projects/snake/smoke.mjs"]` |
| `verifyTimeoutMs` | `120000` | Host timeout per verify command |

Every field is optional; omitted fields use the defaults above (omit `quality` entirely to disable all overrides).

```yaml
quality:
  autoReview: true
  reviewMode: "human"   # 宿主审核通过后停在「待人工复核」
  commandsByProject:
    "projects/贪吃蛇": ["node projects/贪吃蛇/smoke.mjs"]
```

## 🛡️ Boundaries

- No hidden cloud sync: cultivation and feedback diagnostics stay local.
- Approval is explicit: a staged plan does not start until you approve it.
- Deployment requires explicit confirmation; agents do not silently replace a running sect.
- Review is independent: an implementer cannot approve its own implementation.

## 🗺️ Roadmap

- [ ] more sect and role templates;
- [ ] deeper equipment, mount and skill effects in the hall;
- [ ] native app icon set for desktop / web / iOS / Android (desktop PNG ladder + 1024 master ship today; mobile/web sets are generated on demand);
- [ ] more docs and translations;
- [ ] your idea — open an issue.

## 🧑‍💻 Development

    pnpm install
    pnpm typecheck
    pnpm build
    pnpm verify
    pnpm verify:web-routes

On a fresh clone run `pnpm build` before `pnpm verify`: `lib/client/` build intermediates and `*.map` files are generated, not committed. DSH lifecycle skills are resolved live from the shared memory vault, not vendored in this repository.

Useful entry points: [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), [compatibility.json](compatibility.json), [IP & attribution](NOTICE.md).

App icons live in `assets/app-icons/desktop/png/` (16–512 ladder plus the 1024 master) with `assets/app-icons/desktop/app.ico`; the plugin ships `assets/zhulong.ico` / `assets/zhulong-icon.png` for app packaging. Mobile and web icon sets are regenerated from the 1024 master when a release needs them.

## 💬 Community

**Questions, ideas, or DSH plugin talk — join the QQ or WeChat group:**

| QQ group | WeChat group |
|:---:|:---:|
| <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-qr.jpg" target="_blank" rel="noreferrer" title="Click to enlarge"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-qr.jpg" width="220" alt="QQ group QR" /></a> | <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-wechat.jpg" target="_blank" rel="noreferrer" title="Click to enlarge"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/group-wechat.jpg" width="220" alt="WeChat group QR" /></a> |

**Buy the author a coffee (optional):**

| WeChat Pay | WeChat Reward |
|:---:|:---:|
| <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-pay.jpg" target="_blank" rel="noreferrer" title="Click to enlarge"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-pay.jpg" width="200" alt="WeChat Pay QR" /></a> | <a href="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-reward.jpg" target="_blank" rel="noreferrer" title="Click to enlarge"><img src="https://raw.githubusercontent.com/EternalNight996/dsh-super-agents/main/assets/support/wechat-reward.jpg" width="200" alt="WeChat Reward QR" /></a> |

> Sponsorship is optional and changes nothing; the plugin stays MIT and free. See [SPONSOR.md](SPONSOR.md).

- Issues: https://github.com/EternalNight996/dsh-super-agents/issues
- Maintained and published by **惠州市梦游科技有限公司** (Huizhou Mengyou Technology Co., Ltd.).

## 📄 License

MIT © 2026 惠州市梦游科技有限公司. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE) for attribution and license text. The pixel hall, cultivation system, equipment, 封神榜 and 宗门志 are original to this project.

<p align="center"><strong>⭐ Star the repo if you want the hall to keep growing.</strong></p>
