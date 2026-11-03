/**
 * 法脉 (doctrine): the founding workflow a sect is sworn to.
 *
 * The doctrine is a durable clarification field (not only a client template id):
 * it drives the staged task template, the member philosophy and the implicit
 * task-framing audit, so a re-clarify or a restart cannot silently change how
 * the sect delivers. legacy ids stay valid for old teams and rollback.
 */
export const DOCTRINE_IDS = [
    'ship',
    'feat',
    'fix',
    'research',
    'audit',
    'fullstack',
    'hardening',
    'build',
    'array',
    'docs',
    'debate',
    'drama',
];
/** Default doctrine: direct functional delivery (功能直交). */
export const DEFAULT_DOCTRINE = 'ship';
export const DOCTRINE_SPECS = {
    ship: {
        id: 'ship',
        name: '功能直交',
        philosophy: '少绕弯、少概念堆叠：功能直接抵达用户任务；以清晰、可执行、可验证为第一原则；不以花哨概念牺牲功能直达性；直交前由编排角色做一次隐式任务定型（仅内部审计，不打扰用户）。',
    },
    feat: {
        id: 'feat',
        name: '新功能',
        philosophy: '先把需求拆成可验收条目，再实现、验证、审查；不扩大用户没要的范围。',
    },
    fix: {
        id: 'fix',
        name: '修 Bug',
        philosophy: '先复现、再定位根因、后最小修复；修复必须带验证与回归证据。',
    },
    research: {
        id: 'research',
        name: '调研',
        philosophy: '多路取证、只认一手来源；结论逐条挂证据，冲突与不确定性必须显式标注。',
    },
    audit: {
        id: 'audit',
        name: '审计',
        philosophy: '只读检查、逐条给证据；不改工作区，发现按严重度排序。',
    },
    fullstack: {
        id: 'fullstack',
        name: '全栈开发',
        philosophy: '先定契约与边界，前后端并行实现，再联调、验证与审查。',
    },
    hardening: {
        id: 'hardening',
        name: '安全加固',
        philosophy: '只读威胁建模与审计，最小修复，复现利用路径并回归。',
    },
    build: {
        id: 'build',
        name: '构建发布',
        philosophy: '收敛改动、发布前验证、打包发布，版本与回滚方案必须一致。',
    },
    array: {
        id: 'array',
        name: '架构重构',
        philosophy: '先画边界与迁移步骤，再小步重构；对外行为保持不变。',
    },
    docs: {
        id: 'docs',
        name: '文档传道',
        philosophy: '先定读者与结构，再成文；命令必须可跑、事实必须可复核。',
    },
    debate: {
        id: 'debate',
        name: '方案论道',
        philosophy: '正反立论、合论、裁断；推荐必须带残余风险与适用边界。',
    },
    drama: {
        id: 'drama',
        name: '短剧制作',
        philosophy: '角色一致性优先，分镜、镜头、成片逐层审查，成本与时长全程可见。',
    },
};
/** Is this value a stored doctrine id? */
export function isDoctrineId(value) {
    return typeof value === 'string' && DOCTRINE_IDS.includes(value);
}
/** Resolve a spec; unknown/missing values fall back to the direct-delivery default. */
export function getDoctrineSpec(value) {
    return DOCTRINE_SPECS[isDoctrineId(value) ? value : DEFAULT_DOCTRINE];
}
/** Human label used by prompts and the constitution. */
export function doctrineName(value) {
    return getDoctrineSpec(value).name;
}
/** Philosophy block prepended to every member persona through the constitution. */
export function doctrinePhilosophyText(value) {
    const spec = getDoctrineSpec(value);
    return '【法脉：' + spec.name + '】\n' + spec.philosophy;
}
