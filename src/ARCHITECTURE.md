# 核心架构 · 开山宗·000534

## 目标
将现有横向（landscape）布局的面板改为纵向（portrait）排版：面板容器的宽高比例与方向配置随之切换；面板内的内容区块由左右并排改为上下堆叠，标题栏、工具栏与内容区在纵向下的对齐、间距和层级重新排布；补充纵向布局下的滚动方向与内容溢出处理。交互入口与业务逻辑保持不变，样式沿用现有主题变量，在现有前端组件内做最小改动，确保主流程页面可正常打开、关键交互可点击。

## 技术选型 / 平台
- 类型：software · 规模：small · 模式：draft
- 平台：Windows
- 界面：无参考

## 约束（访谈）
- 项目类型：工程任务

## 非目标 / 禁止
- 禁止：禁止过度设计
- 禁止：不写非冒烟测试
- 禁止：不引入新依赖

## 验收基线
- 主流程跑通
- 关键交互可点击

## 模块骨架（任务图）
- t1 [requirements] 明确需求与验收：将现有横向（landscape）布局的面板改为纵向（portrait）排版：面… · 魔修
- t2 [implementation] 实现功能：将现有横向（landscape）布局的面板改为纵向（portrait）排版：面… · 毒修 · 依赖 t1
- t3 [verification] 验证功能：将现有横向（landscape）布局的面板改为纵向（portrait）排版：面… · 体修 · 依赖 t2
- t4 [review] 审查功能：将现有横向（landscape）布局的面板改为纵向（portrait）排版：面… · 魔修 · 依赖 t3
- t5 [requirements] 明确需求：洞府主面板（SectHallOverlay）横版 820×640 → 纵向排版 · 魔修
- t6 [implementation] 实现：洞府主面板纵向排版（SectHallOverlay） · 毒修 · 依赖 t5
- t7 [verification] 验证：洞府主面板纵向排版（实机 + 静态双证） · 体修 · 依赖 t6
- t8 [review] 审查：洞府主面板纵向排版（独立复核 t6） · 魔修 · 依赖 t7
- t9 [requirements] 需求：洞府主面板宽度压缩 + 内部横向排布重构（640 → 更窄） · 魔修 · 依赖 t7
- t10 [implementation] 实现：洞府面板宽度压缩与内部横向重构（按 t9 需求） · captain · 依赖 t9
- t11 [verification] 验证：洞府面板宽度压缩与内部重构（实机 + 静态） · 体修 · 依赖 t10
- t12 [review] 审查：洞府宽度压缩与内部重构（独立复核 t10） · 魔修 · 依赖 t11
- t13 [requirements] 需求：洞府面板嵌入右侧栏 + 设施页面在中间内容区切换（架构级） · 魔修
- t14 [implementation] 实现：洞府迁入右侧栏 + 令牌入口 + 中间区页面切换（删除浮窗） · 毒修 · 依赖 t13
- t15 [verification] 验证：洞府右侧栏化 + 令牌入口 + 中间区切页（实机 + 静态） · 体修 · 依赖 t14
- t16 [review] 审查：洞府右侧栏化（独立复核 t14） · 魔修 · 依赖 t21
- t17 [implementation] 实现：右栏铺满像素活动面板 + 跳转栏移顶部 + 主页路由化 · 毒修 · 依赖 t21
- t18 [verification] 验证：右栏铺满布局 + 顶部导航 + 活动主页路由 · 体修 · 依赖 t22
- t19 [review] 审查：右栏铺满布局与导航重构（独立复核 t17） · 魔修 · 依赖 t18
- t20 [repair] repair-round-2 · 毒修 · 依赖 t14
- t21 [verification] verification-round-2 · 体修 · 依赖 t20
- t22 [repair] repair-round-2 · 毒修 · 依赖 t17
- t23 [review] review-round-2 · 魔修 · 依赖 t22
- t24 [repair] repair-round-3 · 毒修 · 依赖 t22
- t25 [review] review-round-3 · 魔修 · 依赖 t24
- t26 [implementation] 实现：右栏洞府块不再全屏覆盖，恢复宿主原有布局（活动面板可见） · 毒修 · 依赖 t25
- t27 [verification] 验证：右栏不再覆盖全屏 + 原有活动面板可见 · 体修 · 依赖 t26
- t28 [review] 审查：右栏布局回退（独立复核 t26） · 魔修 · 依赖 t27
- t29 [implementation] 实现：洞府全部操作收进右侧栏，不切中间区、不遮挡对话 · 毒修 · 依赖 t26
- t30 [verification] 验证：右栏内完成全部操作 + 对话始终保留 · 体修 · 依赖 t29
- t31 [review] 审查：右栏内操作方案（独立复核 t29） · 魔修 · 依赖 t30
- t32 [requirements] 需求：对话框中提供「停止当前任务并执行新任务」按钮 · 魔修
- t33 [implementation] 实现：composer 内「停止当前任务并执行新任务」按钮 + /task/preempt 路由 · 毒修 · 依赖 t29,t31
- t34 [verification] 验证：停止当前任务按钮（出现条件 / 二次确认 / 排队任务立即调度） · 体修 · 依赖 t33
- t35 [review] 审查：停止当前任务按钮（独立复核 t33） · 魔修 · 依赖 t40
- t36 [implementation] 实现：右栏顶部栏统一为 8 个入口（首页/总进度/设施页）+ 分隔栏 · 毒修 · 依赖 t33
- t37 [verification] 验证：8 入口顶部栏 + 首页完整场景 + 总进度可切换 + 分隔栏 · 体修 · 依赖 t36
- t38 [review] 审查：8 入口顶部栏改版（独立复核 t36） · 魔修 · 依赖 t37
- t39 [repair] repair-round-2 · 毒修 · 依赖 t33
- t40 [verification] verification-round-2 · 体修 · 依赖 t39
- t41 [repair] repair-round-2 · captain · 依赖 t33
- t42 [verification] verification-round-2 · 体修 · 依赖 t41
- t43 [implementation] 实现：去掉底部重复团队卡 + 创建任务后默认显示总进度 · 毒修 · 依赖 t36
- t44 [verification] 验证：底部重复团队卡已去除 + 新建任务后默认总进度 · 体修 · 依赖 t43
- t45 [implementation] 实现：右栏底部不留白（洞府块撑满剩余高度） · 毒修 · 依赖 t36
- t46 [verification] 验证：右栏底部无留白（两档视口） · 体修 · 依赖 t45
- t47 [implementation] 修复：天机阁显示无宗门 + 总进度宽度自适应 · 毒修 · 依赖 t45
- t48 [implementation] 实现：总进度页横向铺满（去掉 560 上限 + 成员多列） · 毒修 · 依赖 t47
- t49 [verification] 验证：总进度页横向铺满（宽栏/窄栏） · 体修 · 依赖 t48
- t50 [work] 占位测试任务 A：读 README 写两行摘要后结单 · 魔修
- t51 [work] 占位测试任务 B：读 README 写两行摘要后结单 · 毒修
- t52 [work] 占位测试任务 C：读 README 写两行摘要后结单 · 体修
- t53 [work] 占位测试任务 D：读 README 写两行摘要后结单 · 魔修
- t54 [work] 占位联调 A：通读 HallSidebar 源码并写结构说明 · 魔修
- t55 [work] 占位联调 B：通读 HallSidebar 源码并写结构说明 · 毒修
- t56 [work] 占位联调 C：通读 HallSidebar 源码并写结构说明 · 体修
- t57 [work] 占位联调 D：通读 HallSidebar 源码并写结构说明 · 魔修
- t58 [work] 验证用长任务 A：精读两个客户端文件并写 120 行说明 · 魔修
- t59 [work] 验证用长任务 B：精读两个客户端文件并写 120 行说明 · 毒修
- t60 [work] 验证用长任务 C：精读两个客户端文件并写 120 行说明 · 体修
- t61 [work] 验证用长任务 D：精读两个客户端文件并写 120 行说明 · 魔修
- t62 [work] 验证用长任务 E：精读 ActivityPanel 并写 120 行说明 · 毒修
- t63 [work] 驻留任务 A：等待 10 分钟后结单（用于按钮验证） · 魔修
- t64 [work] 驻留任务 B：等待 10 分钟后结单（用于按钮验证） · 毒修
- t65 [work] 驻留任务 C：等待 10 分钟后结单（用于按钮验证） · 体修
- t66 [work] 排队任务：等前面的驻留任务结束后写一行结单说明 · 魔修
- t67 [implementation] 修复：叫停后排队任务未真正开跑（assignee 不是被中断成员时） · captain · 依赖 t33
- t68 [work] 驻留 甲：等待 10 分钟后结单（preempt 复现用） · 毒修
- t69 [work] 驻留 乙：等待 10 分钟后结单（preempt 复现用） · 魔修
- t70 [work] 驻留 丙：等待 10 分钟后结单（preempt 复现用） · 体修
- t71 [work] 排队任务：被叫停后应立刻开跑（assigned 魔修） · 魔修
- t72 [work] 排队任务（assignee 毒修，用于复现改派） · 毒修
- t73 [implementation] 修复：切到右栏其它标签后被自动拽回宗门协作（openTab 抢焦点） · 毒修

## 产物与边界
- 产物根目录：src/（只写该目录，不改平台/插件代码）