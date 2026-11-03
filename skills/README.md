# 项目维护 Skills

本目录只保留维护本插件**必需**的 6 个 skill。其余 DSH 生命周期 skill 不再内置：需要时从共享记忆库（memory-eternal）取当前地址后加载，避免同一份资料在多个仓库里重复维护。`.agents/skills/` 保留同名的发现链接，不再维护 `.dsh/skills/` 镜像。

## 来源与许可

5 个上游 skill 来自 [oh-my-dsh/dsh-plugin-upgrade-skill](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill/tree/eeff1cdcffe4013e094d94c8d9b8651a65fbc79a)，固定 commit `eeff1cdcffe4013e094d94c8d9b8651a65fbc79a`（2026-09-25）。只保留维护子集，文件级 SHA-256 见 [upstream-lock.json](upstream-lock.json)，MIT 许可见 [LICENSE.dsh-plugin-upgrade-skill](LICENSE.dsh-plugin-upgrade-skill)。

`dsh-plugin-development` 由本项目单独维护，不属于上游 hash 清单。

这些资料是开发维护工具，不是运行时依赖；npm `files` 清单不包含本目录。需要新增其他 skill 时，先从共享记忆库确认地址与版本，再按需引入并补充发现链接；不要自动追随上游 `main`。

## 使用入口

| 任务 | 项目内 skill | 用法 |
| --- | --- | --- |
| 版本影响与迁移 | [plugin-upgrade](plugin-upgrade/SKILL.md) | 版本变更链、只读扫描、迁移计划和实现验证 |
| 官方契约核对 | [dsh-upgrade-audit](dsh-upgrade-audit/SKILL.md) | 精确 tag/源码或 npm 产物对比，补全版本卡遗漏 |
| 产品与包测试 | [plugin-test](plugin-test/SKILL.md) | 七类触点、真实宿主加载、tarball smoke 和自定义功能探针 |
| 打包发布 | [plugin-release](plugin-release/SKILL.md) | 产物闭包、发布一致性检查；必须遵守下方项目规则 |
| 编写插件 | [plugin-write](plugin-write/SKILL.md) | 目标接口、命名、配置与开发模板 |
| 开发与排障 | [dsh-plugin-development](dsh-plugin-development/SKILL.md) | host/client 形态、Service、slot、构建、HMR 与真实组合验证 |

同名全局 skill 可能来自其他来源或版本；本项目任务明确读取上表的项目路径。用户当前已授权的任务不需要因为上游通用模板再重复征求确认；新增超出任务范围的发布等动作按会话指令处理。交互式浏览器操作使用 Ego Lite，遵守项目 `AGENTS.md`。

## 本项目的适用规则

2026-09-11 补充：维护者已明确将验收过的 `0.1.17-rc.1` 提升至 npm `latest`。RC 首发仍走 `next`，通过验收后可显式提升同一不可变产物；GitHub Release 保留预发布标志。此项目规则覆盖上游 skill 的“预发布只能进入非 latest”默认约定，发布历史见 [CHANGELOG.md](../CHANGELOG.md)。

1. **版本卡是线索，不是完整 API 差异。** 当前库没有 `registerContinuableSetup`、`followup`、`sendMessage` 的专项迁移指导。`report → send_message` 工具卡不等同于子代理 runtime API 迁移。#130 必须继续用精确官方实现和本项目生命周期测试核验。
2. **宿主、插件、发布渠道分别记录。** GitHub tag 不代表 npm 已发布；宿主 `latest` 与插件 `latest` 不保证兼容。普通用户默认组合只能来自 AgentTeams 验收矩阵；Alpha 预览须显式选择。
3. **精确 CLI 版本还不够。** 固定并检查完整宿主依赖闭包和实际 profile。不要将 `npm install -g @deepseek-ai/dsh@<exact>` 视为所有分包已固定，也不要把宽 peer 范围当作支持承诺。
4. **发布文档中的历史基线不直接采用。** 当前导入版本仍出现“npm 基线 0.1.1-rc.2”“所有 0.1.2-alpha.* 未发布”和宽 peer `<0.2.0` 的陈旧或矛盾说明。以当次 registry 查询、精确产物和实测矩阵为准。
5. **发布校验需包含宿主支持证据。** 上游 `verify-release` 只校验插件自身版本/标签；无后缀插件可能仍然只支持 Alpha 宿主。通过该脚本不能直接进入 `latest`。它还强制无后缀版本使用 `latest`，因此并不支持所有候选包推广流程。
6. **回退要区分对象。** Git tag、GitHub release、npm tarball、dist-tag、用户 profile 和持久化数据是不同对象。不要套用“删除/重指向 Git tag”来回滚 npm 包或用户安装。
7. **测试通过要说明范围。** 52 道 Harbor 题测 AI 的迁移能力，不是 AgentTeams 的 52 项回归。Docker ready 或 HTTP 200 只证明特定启动条件；发布需要插件激活、队员唤醒/执行/回报、模型与推理力度、失败收尾、恢复和 UI 的项目探针。
8. **只读扫描避开维护资料本身。** planner 会扫描代码、配置和脚本，也会命中 vendored skills 的示例。分析生产仓库时使用清楚标识的源码快照，或逐条排除这些维护资料带来的结果；零命中不等于没有风险。
9. **新增检查器也有版本范围。** `inject-lint` 面向 alpha.2，并把 Cordis peer 必须等于 `^4.0.1` 写死；AgentTeams 已使用 `^4.0.2`，不能按其 `FIX-REQUIRED` 机械降级。新版 publish-playbook 的 amend/re-tag/force-push 历史修复配方也不适用于本项目已发布产物；修复应使用新插件版本并遵循项目发布规则。
