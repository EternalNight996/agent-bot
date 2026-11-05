/**
 * 阵营构造系统：把一支团队拆成可调度的岗位组合。
 *
 * 阵营不是皮肤包：每个阵营同时定义
 *   1) 调度拓扑（谁编排、谁并行、谁只做审计）
 *   2) 角色行为参数（自主度、预算、权限、约束）
 *   3) 视觉母题与色板
 * 组队时选择的 faction 会进入澄清/宪法，约束成员 persona 与计划生成。
 * 角色 id 必须来自现有 ROLE_META，避免发明第二套身份系统。
 */
export const FACTION_IDS = ['pilgrim', 'celestial', 'buddhist', 'hidden', 'ancient', 'primordial', 'dragon', 'underworld', 'demon'];
const PILGRIM = {
    id: 'pilgrim',
    name: '标准交付组',
    tagline: '单线程推进 · 关键路径集中攻坚',
    sourceLogic: '一个目标清晰但不出手的项目经理，配一个能力最强、需要约束的核心执行者，加一个负责变体与兜底的分析节点，加一个沉默的基础执行层。标准交付组的调度特征是单线程推进 + 关键路径集中调用全栈工程师。',
    topology: 'single-thread',
    topologyLabel: '路线推进型',
    audit: 'standard',
    auditLabel: '标准审计',
    parallelism: '默认单线程；只有独立取证/变体可并行；主线阻塞时由分析师开替代路径。',
    motif: '流程图 · 任务板 · 交付印章',
    palette: { primary: '#b8873d', accent: '#a93b2c', ink: '#221a12', paper: '#f3e7d2' },
    members: [
        { name: '产品经理', role: 'planner', duty: '目标定义与价值裁决；不参与具体执行，只在方向偏移时否决', autonomy: 'low', budget: 'low', permissions: ['只读', '目标重定义'], constraint: '不调用写文件/执行命令工具' },
        { name: '全栈工程师', role: 'implementer', duty: '复杂攻坚、架构突破、多步工具调用链', autonomy: 'high', budget: 'high', permissions: ['写文件', '执行命令', '多步工具链'], constraint: '权限边界由产品经理的规则动态收紧' },
        { name: '分析师', role: 'analyst', duty: '用户反馈代理、方案变体生成、失败恢复', autonomy: 'medium-low', budget: 'low', permissions: ['发起建议', '生成候选'], constraint: '不可直接修改核心资产' },
        { name: '运维', role: 'operator', duty: 'CI/CD、跨平台配置、构建脚本、文件系统操作', autonomy: 'medium', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '可预期性优先，不做架构决策' },
        { name: '文档工程师', role: 'documenter', duty: '持久化记忆层、会话上下文承载、跨任务状态同步', autonomy: 'very-low', budget: 'minimal', permissions: ['只读写状态'], constraint: '不主动发言，不调用生成工具' },
        { name: 'QA', role: 'verifier', duty: '质量监理：验收口径、跨角色协调、异常上报', autonomy: 'medium', budget: 'medium', permissions: ['只读', '标记异常', '跨阵营消息'], constraint: '不直接修实现，只提交 findings' },
        { name: '技术评审', role: 'reviewer', duty: '终局验收：只判断是否越过边界，不参与过程', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '终审'], constraint: '只在边界被触碰时介入' },
    ],
    orchestration: '调度拓扑：单线程推进。产品经理先定义目标与不可逾越的边界；全栈工程师承担主线攻坚，分析师在主线受阻时开替代路径，运维负责落地与构建，文档工程师只维护持久状态。QA 做质量监理，技术评审只在终局边界被触碰时裁决。除独立取证/变体外不并行；任何多步写操作先报产品经理。',
};
const CELESTIAL = {
    id: 'celestial',
    name: '并行交付组',
    tagline: '层级裁决 · 多路并行交付 · 结果上报',
    sourceLogic: '产品经理是最高决策者，本人不出手；集成工程师负责需求调和与对外沟通；四个执行方向分别驻守架构、前端、后端、质量；全栈工程师主管依赖与资源但技术裁决有限。并行交付组的调度特征是分层决策 + 多路并行交付 + 结果上报。',
    topology: 'layered',
    topologyLabel: '层级裁决型',
    audit: 'standard',
    auditLabel: '标准审计',
    parallelism: '产品经理拆多路，架构、前端、后端、质量四路并行执行；全栈工程师管依赖/资源，技术评审独立验收。',
    motif: '并行泳道 · 里程碑旗 · 上报回执',
    palette: { primary: '#c9a54a', accent: '#3f6b7a', ink: '#151b22', paper: '#eef0ea' },
    members: [
        { name: '产品经理', role: 'planner', duty: '终局编排：拆解目标为多路任务，分配四路并行执行并汇总', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只编排', '不调用生成工具'], constraint: '本人不出手，不直接改代码' },
        { name: '集成工程师', role: 'integrator', duty: '需求访谈、方案调和、冲突消解', autonomy: 'medium', budget: 'medium', permissions: ['修改任务契约', '跨层沟通'], constraint: '不修改技术实现' },
        { name: '架构师', role: 'architect', duty: '架构与边界；东路架构执行', autonomy: 'medium-high', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '独立执行，结果上报产品经理' },
        { name: '前端工程师', role: 'frontend', duty: '前端与交互；南路并行执行', autonomy: 'medium-high', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '独立执行，结果上报产品经理' },
        { name: '后端工程师', role: 'backend', duty: '后端与数据；西路并行执行', autonomy: 'medium-high', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '独立执行，结果上报产品经理' },
        { name: 'QA', role: 'verifier', duty: '质量验证；北路并行执行', autonomy: 'medium-high', budget: 'medium', permissions: ['只读', '运行验证', '提交 findings'], constraint: '独立验证，不替实现者改代码' },
        { name: '全栈工程师', role: 'implementer', duty: '执行层总协调：带队落地多路任务，管理四路依赖与资源竞争', autonomy: 'medium', budget: 'low', permissions: ['写文件', '执行命令', '调度'], constraint: '不具备技术裁决权，冲突上报产品经理' },
        { name: '技术评审', role: 'reviewer', duty: '独立验收与异常追踪；全链路日志审查', autonomy: 'medium', budget: 'medium', permissions: ['只读', '全链路日志', '标记异常'], constraint: '不可自行修复' },
    ],
    orchestration: '调度拓扑：层级裁决。产品经理只编排，不直接调用生成工具；集成工程师负责需求调和与契约；架构、前端、后端、质量四路并行，全栈工程师只协调依赖与资源、不做技术裁决；技术评审独立验收并查全链路日志。任何跨路冲突上报产品经理，不自行合并。',
};
const BUDDHIST = {
    id: 'buddhist',
    name: '验收交付组',
    tagline: '先定终局边界 · 并行验证单元',
    sourceLogic: '技术评审是终局裁决者；产品经理是执行层核心，负责统筹交付；架构师与全栈工程师分别负责方案与落地；QA 是并行验证单元，集体出动执行专项任务。验收交付组的调度特征是先定终局边界，再以并行单元验证。',
    topology: 'terminal-parallel',
    topologyLabel: '终局定调 + 并行验证型',
    audit: 'strict',
    auditLabel: '严格审计',
    parallelism: '技术评审先定边界；架构师并行出方案；全栈工程师落地；QA 拆成并行验证单元。',
    motif: '验收签章 · 并行闸门 · 通过清单',
    palette: { primary: '#d9b45a', accent: '#e8e1d2', ink: '#1b1914', paper: '#faf6ec' },
    members: [
        { name: '技术评审', role: 'reviewer', duty: '设定不可逾越的架构边界与验收终局；不参与中间过程', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '边界裁定'], constraint: '只在边界被触碰时介入' },
        { name: '产品经理', role: 'planner', duty: '跨 Agent 统筹交付；管理组内单元并对外建立 MCP 子任务', autonomy: 'high', budget: 'high', permissions: ['调度内部 Agent', '建立 MCP 子任务', '跨阵营协调'], constraint: '不越过技术评审设定的边界' },
        { name: '架构师', role: 'architect', duty: '方案推演与架构设计；输出可选方案集，不直接写实现', autonomy: 'medium', budget: 'medium', permissions: ['只读', '生成方案', '权衡分析'], constraint: '不直接落实现' },
        { name: '全栈工程师', role: 'implementer', duty: '把架构师输出的方案落地为可执行任务链', autonomy: 'medium-high', budget: 'high', permissions: ['写文件', '执行命令'], constraint: '遵循技术评审边界与产品经理排程' },
        { name: 'QA', role: 'verifier', duty: '并行验证集群：批量测试、多路径尝试、交叉审查', autonomy: 'medium', budget: 'medium', permissions: ['只读', '运行测试', '交叉审查'], constraint: '各自独立，结果汇总至产品经理' },
        { name: '文档工程师', role: 'documenter', duty: '结集与文档：把通过验证的结论写成可复现记录', autonomy: 'low', budget: 'low', permissions: ['只读', '写文档'], constraint: '不修改实现与验证结论' },
    ],
    orchestration: '调度拓扑：终局定调 + 并行验证。技术评审先给出不可逾越的边界与验收终局，产品经理据此统筹并对外建立 MCP 子任务；架构师并行产出可选方案，全栈工程师把选定方案落地；QA 拆成多个独立验证单元并行跑，结果汇总产品经理，再由技术评审终审。审计强度严格：任何边界触碰都必须停下上报。',
};
const DRAGON = {
    id: 'dragon',
    name: '基础设施组',
    tagline: '基础设施 · 资源与持久化底座',
    sourceLogic: '运维是基础设施的分区负责人，掌管运行环境与资源调度。基础设施组的价值不在于功能开发，而在于提供运行时所需的资源与持久化能力，同时受交付节律约束。',
    topology: 'infrastructure',
    topologyLabel: '基础设施型',
    audit: 'light',
    auditLabel: '轻量审计',
    parallelism: '资源请求并行处理；写操作按资源分区串行；清理任务定时触发。',
    motif: '机架 · 存储阵列 · 巡检灯',
    palette: { primary: '#3f7fb8', accent: '#bfe8e0', ink: '#0e1a22', paper: '#e9f4f4' },
    members: [
        { name: '运维', role: 'operator', duty: '存储与数据底座：项目状态、文件系统、构建缓存', autonomy: 'low', budget: 'low', permissions: ['读写状态', '管理缓存'], constraint: '只响应资源请求，不主动生成' },
        { name: '集成工程师', role: 'integrator', duty: '多环境同步：本地/CI/部署配置一致性与状态同步', autonomy: 'medium-low', budget: 'medium', permissions: ['环境配置', '同步状态'], constraint: '按需触发，不改变业务逻辑' },
        { name: '审计', role: 'auditor', duty: '轻量巡检与清理：依赖更新、临时文件、过期分支', autonomy: 'very-low', budget: 'minimal', permissions: ['只读巡检', '清理临时文件'], constraint: '定时/事件触发，不可调用生成模型' },
        { name: '分析师', role: 'planner', duty: '资源规划：把目标翻译成容量/分区/持久化需求', autonomy: 'medium', budget: 'low', permissions: ['只读', '规划资源'], constraint: '不直接改业务代码' },
        { name: '全栈工程师', role: 'implementer', duty: '基础设施实现：部署脚本、存储适配、数据迁移', autonomy: 'medium', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '写操作前报运维' },
        { name: 'QA', role: 'verifier', duty: '资源与持久化验证：读写一致性、故障恢复、容量回归', autonomy: 'medium', budget: 'medium', permissions: ['只读', '故障注入', '提交 findings'], constraint: '不直接修复' },
        { name: '技术评审', role: 'reviewer', duty: '终审资源变更：容量、迁移、删除与权限', autonomy: 'low', budget: 'minimal', permissions: ['只读', '终审'], constraint: '只判定，不执行' },
    ],
    orchestration: '调度拓扑：基础设施型。运维是存储与状态底座，只响应资源请求；集成工程师负责多环境同步，按资源分区串行写；审计只做定时巡检/清理，绝不调用生成模型；分析师规划资源，全栈工程师实现，QA 验证，技术评审终审高风险变更。轻量审计，不阻塞常规读写。',
};
const UNDERWORLD = {
    id: 'underworld',
    name: '审计组',
    tagline: '不可篡改记录 · 规则判定 · 异常回收',
    sourceLogic: '技术评审是终审岗，专审重罪；审计掌管规则账本，逐条比对；QA 专职异常捕获与外勤取证。审计组的调度特征是不可篡改的记录 + 规则判定 + 异常回收。',
    topology: 'audit',
    topologyLabel: '审计追踪型',
    audit: 'strict',
    auditLabel: '严格审计',
    parallelism: '审计与回收并行；高风险变更串行终审；记录只追加不覆盖。',
    motif: '审计日志 · 只追加账本 · 追踪线',
    palette: { primary: '#6b7f5a', accent: '#a93b2c', ink: '#161a16', paper: '#e8e4d8' },
    members: [
        { name: '技术评审', role: 'reviewer', duty: '终审高风险变更（删除、迁移、权限变更）', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '终审'], constraint: '只判定，不执行' },
        { name: '审计', role: 'auditor', duty: '规则引擎：命名、目录结构、依赖白名单逐条校验', autonomy: 'low', budget: 'low', permissions: ['只读', '规则匹配'], constraint: '不修改规则或代码' },
        { name: 'QA', role: 'verifier', duty: '异常捕获与回收：失败任务、超时调用、死循环归因', autonomy: 'medium', budget: 'medium', permissions: ['终止进程', '只读归因'], constraint: '不可修改代码' },
        { name: '分析师', role: 'planner', duty: '目标与边界：把审计目标拆成可判定规则', autonomy: 'medium', budget: 'low', permissions: ['只读', '定义规则'], constraint: '不直接实现修复' },
        { name: '修复工程师', role: 'implementer', duty: '异常修复：按审计规则做最小修复', autonomy: 'medium', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '修复前先记录规则命中' },
        { name: '文档工程师', role: 'documenter', duty: '投递记录：把判定、证据与残余风险写入不可篡改日志', autonomy: 'very-low', budget: 'minimal', permissions: ['只追加写入'], constraint: '不删除、不改写历史记录' },
    ],
    orchestration: '调度拓扑：审计追踪型。分析师定义可判定规则；审计逐条校验并只追加记录；QA 并行捕获异常并归因；修复工程师做最小修复；技术评审终审高风险变更；文档工程师只追加写证据。审计强度严格，任何删除/迁移/权限变更必须终审。',
};
const DEMON = {
    id: 'demon',
    name: '快速试验组',
    tagline: '快速试错 · 多路径覆盖 · 快速淘汰',
    sourceLogic: '性能工程师是唯二能扛住极限压测的角色；分析师实力弱但能快速变体；测试工程师会拿捏边界但变化功底有限。快速试验组的调度特征是不追求稳健，追求多路径覆盖和快速淘汰。',
    topology: 'rapid-trial',
    topologyLabel: '快速试错型',
    audit: 'light',
    auditLabel: '轻量审计（结果导向）',
    parallelism: '多候选并行，按成本/收益快速淘汰；主线只接收胜出者。',
    motif: '候选池 · 试跑轨迹 · 淘汰标记',
    palette: { primary: '#c24b2f', accent: '#e8d8c0', ink: '#1a1210', paper: '#f4e8dc' },
    members: [
        { name: '性能工程师', role: 'implementer', duty: '性能攻坚：计算密集、高并发、底层优化', autonomy: 'high', budget: 'high', permissions: ['写文件', '执行命令', '压测'], constraint: '只用于攻坚，不用于日常琐事' },
        { name: '分析师', role: 'analyst', duty: '低成本变体生成：快速生成多个原型/方案用于 A/B 淘汰', autonomy: 'medium', budget: 'minimal', permissions: ['生成候选', '只读'], constraint: '输出只进候选池，不直接进主线' },
        { name: '测试工程师', role: 'tester', duty: '单点突破：针对关键功能/交互做短周期高密度迭代', autonomy: 'medium-high', budget: 'medium', permissions: ['写文件', '执行命令'], constraint: '预算集中，不具全局调度权' },
        { name: '产品经理', role: 'planner', duty: '候选池编排：定义试错目标、淘汰标准与晋级条件', autonomy: 'medium', budget: 'low', permissions: ['编排', '淘汰'], constraint: '不直接改代码' },
        { name: 'QA', role: 'verifier', duty: '候选验证：对晋级候选做快速回归与资源检查', autonomy: 'medium', budget: 'low', permissions: ['只读', '运行测试'], constraint: '只验证候选，不参与生成' },
        { name: '技术评审', role: 'reviewer', duty: '终审：判断胜出候选是否可进主线，记录失败原因', autonomy: 'medium', budget: 'low', permissions: ['只读', '终审'], constraint: '不可自行修复' },
    ],
    orchestration: '调度拓扑：快速试错。产品经理定义试错目标和淘汰标准；分析师低成本量产候选；测试工程师对单点做高密度迭代；性能工程师只处理性能攻坚；QA 快速验证候选；技术评审终审胜出者。允许并行多候选，但主线只接收胜出者；轻量审计，失败快速淘汰。',
};
const HIDDEN = {
    id: 'hidden',
    name: '单线交付组',
    tagline: '单点传承 · 不争而观局',
    sourceLogic: '架构师只带一名亲传，只讲路径与方法；他教出全栈工程师，却在其卖弄时立刻收回权限。单线交付组不争功、不入局，只做传承与观局，调度特征是单点传承 + 一次只带一名亲传。',
    topology: 'lineage',
    topologyLabel: '单点传承型',
    audit: 'light',
    auditLabel: '轻量审计（暗中观局）',
    parallelism: '一次只带一名亲传；主线单点突破，分析师/运维只给线索与护法；不并行多主线。',
    motif: '一对一笔记 · 线索地图 · 观局眼',
    palette: { primary: '#6f8f8a', accent: '#c9d8cf', ink: '#101817', paper: '#e9f0e9' },
    members: [
        { name: '架构师', role: 'planner', duty: '传承与定路径：只指出路径、不替亲传出手', autonomy: 'orchestrate-only', budget: 'low', permissions: ['只读', '传授心法'], constraint: '不直接实现，不替亲传做决定' },
        { name: '全栈工程师', role: 'implementer', duty: '亲传的单点突破：把架构师的方法落成实现', autonomy: 'high', budget: 'high', permissions: ['写文件', '执行命令', '多步工具链'], constraint: '受单线规则约束，卖弄/越界即被收回权限' },
        { name: '分析师', role: 'analyst', duty: '外部线索：指路、给外部视角、提示风险', autonomy: 'medium-low', budget: 'low', permissions: ['只读', '给线索'], constraint: '不进入主线实现' },
        { name: '运维', role: 'operator', duty: '基础设施与基础执行：环境、文件、状态维护', autonomy: 'low', budget: 'minimal', permissions: ['写状态', '执行基础命令'], constraint: '不参与传承与决策' },
        { name: 'QA', role: 'verifier', duty: '护法与验证：检验亲传成果是否守住方法论', autonomy: 'medium', budget: 'low', permissions: ['只读', '运行验证', '提交 findings'], constraint: '不替亲传修改实现' },
        { name: '技术评审', role: 'reviewer', duty: '终审：只指点方向，不落凡尘', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '终审'], constraint: '只给判词与方向，不写实现' },
    ],
    orchestration: '调度拓扑：单点传承。架构师只传法、指路，不替亲传出手；一次只带一名亲传（通常是全栈工程师），由他单点突破；分析师给线索，运维守基础，QA 验证，技术评审终审。不并行多主线；亲传越界/卖弄时立即收回权限。',
};
const ANCIENT = {
    id: 'ancient',
    name: '架构评审组',
    tagline: '规则先行 · 合议改写',
    sourceLogic: '评审组只守规则，不涉琐碎实现；并行交付组只是执行代理人。产品经理定义秩序、全栈工程师演练实现、技术评审守住合议；架构师负责结构与方案，运维负责落地，QA 守住闭环。架构评审组的调度特征是超然裁决 + 规则改写 + 三方合议。',
    topology: 'transcendent',
    topologyLabel: '超然裁决型',
    audit: 'strict',
    auditLabel: '严格审计（合议制）',
    parallelism: '三席各掌一道，重大规则改动需合议；架构师/运维执行，QA 验证；冲突规则不合议不落地。',
    motif: '三方合议 · 规则草案 · 版本印章',
    palette: { primary: '#8f7bd8', accent: '#c9b8e8', ink: '#15121f', paper: '#f0ecf8' },
    members: [
        { name: '产品经理', role: 'planner', duty: '定义秩序：给出不可逾越的规则与边界', autonomy: 'orchestrate-only', budget: 'low', permissions: ['只读', '定义规则', '合议'], constraint: '不亲执工具，不直接落实现' },
        { name: '全栈工程师', role: 'implementer', duty: '实现执行：把合议后的规则落成可运行的实现', autonomy: 'high', budget: 'high', permissions: ['写文件', '执行命令', '多步工具链'], constraint: '不得越过产品经理定义的边界' },
        { name: '技术评审', role: 'reviewer', duty: '合议终审：只判断是否合规则，不参与过程', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '终审'], constraint: '只裁断，不修复' },
        { name: 'QA', role: 'verifier', duty: '闭环验证：规则、资源、结果是否闭环', autonomy: 'medium', budget: 'medium', permissions: ['只读', '运行验证', '提交 findings'], constraint: '不修改实现' },
        { name: '架构师', role: 'architect', duty: '方案与架构：把合议规则翻译成可执行结构', autonomy: 'medium', budget: 'medium', permissions: ['写文档', '设计结构'], constraint: '方案需合议通过' },
        { name: '运维', role: 'operator', duty: '执行落地：构建、部署、环境与状态', autonomy: 'low', budget: 'low', permissions: ['写文件', '执行命令'], constraint: '只执行已批准规则' },
    ],
    orchestration: '调度拓扑：超然裁决。产品经理定义规则边界，全栈工程师执行实现，架构师出结构，运维落地，QA 验证闭环，技术评审终审。审计严格：任何规则改写必须合议；未合议的改动一律回退。',
};
const PRIMORDIAL = {
    id: 'primordial',
    name: '攻坚交付组',
    tagline: '从零直造 · 直接造物',
    sourceLogic: '产品经理定形，全栈工程师从零造物，架构师把混沌需求演成结构，QA 逐条验证，安全工程师做破坏性测试，测试工程师守住回归，文档工程师只记录，技术评审只在规则冲突时收口。攻坚交付组不靠流程堆叠，直接以自身能力造物与改规则；调度特征是直造 + 多角色并行 + 事后记录。',
    topology: 'primordial',
    topologyLabel: '直造型',
    audit: 'light',
    auditLabel: '轻量审计（结果导向）',
    parallelism: '产品经理定形、全栈工程师直造、架构师出结构可并行；安全/测试做破坏性与回归；文档工程师只记录；技术评审只在规则冲突时收口。',
    motif: '从零脚手架 · 结构骨架 · 交付现场',
    palette: { primary: '#c9a227', accent: '#6f8fb8', ink: '#100f0c', paper: '#f2ead8' },
    members: [
        { name: '产品经理', role: 'planner', duty: '定形与收口：定义造物的形态、缺口与收口标准', autonomy: 'medium', budget: 'high', permissions: ['定义形态', '收口'], constraint: '不替代全栈工程师直造' },
        { name: '全栈工程师', role: 'implementer', duty: '从零实现：最高强度的从零实现与破坏性重构', autonomy: 'high', budget: 'unlimited', permissions: ['写文件', '执行命令', '破坏性重构'], constraint: '破坏性操作先报产品经理' },
        { name: '架构师', role: 'architect', duty: '定序：把混沌需求演成可执行规则', autonomy: 'medium-high', budget: 'medium', permissions: ['写文档', '定义结构'], constraint: '规则需 QA 验证' },
        { name: 'QA', role: 'verifier', duty: '逐条验证造物是否可用、可复现', autonomy: 'medium', budget: 'medium', permissions: ['只读', '运行验证', '提交 findings'], constraint: '不修改造物' },
        { name: '安全工程师', role: 'security', duty: '压力、故障注入、边界破坏测试', autonomy: 'medium-high', budget: 'medium', permissions: ['故障注入', '压力测试'], constraint: '不破坏主线环境' },
        { name: '测试工程师', role: 'tester', duty: '高密度回归与关键路径燃烧测试', autonomy: 'medium', budget: 'medium', permissions: ['运行测试', '只读'], constraint: '不直接改实现' },
        { name: '文档工程师', role: 'documenter', duty: '只追加记录造物过程、证据与残余风险', autonomy: 'very-low', budget: 'minimal', permissions: ['只追加写入'], constraint: '不删除、不改写历史' },
        { name: '技术评审', role: 'reviewer', duty: '终审：只在规则冲突时收口', autonomy: 'orchestrate-only', budget: 'minimal', permissions: ['只读', '终审'], constraint: '不参与日常造物' },
    ],
    orchestration: '调度拓扑：直造。产品经理定形与收口，全栈工程师从零实现，架构师出结构，QA 验证，安全工程师/测试工程师做破坏性与回归测试，文档工程师只追加记录，技术评审只在规则冲突时终审。允许并行造物，但必须由产品经理收口；轻量审计，结果导向。',
};
export const FACTIONS = [PILGRIM, CELESTIAL, BUDDHIST, HIDDEN, ANCIENT, PRIMORDIAL, DRAGON, UNDERWORLD, DEMON];
const TOPOLOGY_PARALLEL = {
    'single-thread': 1,
    lineage: 1,
    layered: 4,
    'terminal-parallel': 4,
    transcendent: 2,
    primordial: 4,
    infrastructure: 2,
    audit: 2,
    'rapid-trial': 3,
};
/** 实机并行上限：调度器用它限制同一时刻开放的任务数。 */
export function factionMaxParallel(faction) {
    return faction.maxParallel ?? TOPOLOGY_PARALLEL[faction.topology];
}
export function isFactionId(value) {
    return typeof value === 'string' && FACTION_IDS.includes(value);
}
export function factionById(id) {
    return id === undefined ? undefined : FACTIONS.find(faction => faction.id === id);
}
export function factionRoleNames(faction) {
    return Object.fromEntries(faction.members.map(member => [member.role, member.name]));
}
export function factionPrompt(faction) {
    return [
        '阵营：' + faction.name + '（' + faction.tagline + '）',
        '行为逻辑：' + faction.sourceLogic,
        '调度拓扑：' + faction.topologyLabel + '。' + faction.parallelism,
        '审计强度：' + faction.auditLabel + '。',
        '视觉母题：' + faction.motif + '。',
        faction.orchestration,
        '成员行为参数：',
        ...faction.members.map(member => '- ' + member.name + '（' + member.role + '）：自主度=' + member.autonomy
            + '；预算=' + member.budget + '；权限=' + member.permissions.join('/') + '；约束=' + member.constraint + '。职责：' + member.duty),
    ].join('\n');
}
