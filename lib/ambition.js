/**
 * 宏愿 (ambition): an OPTIONAL emphasis, off unless the user turns it on.
 *
 * It is not a development mode: modes own delivery rigor, verification and
 * budget, while an ambition only adds an emphasis to the prompts/constitution.
 * Keeping it optional is what makes it cheap — an unselected ambition injects
 * nothing anywhere. 视觉爆炸 is the only one the founding UI offers today.
 */
export const AMBITION_IDS = [
    'visual',
    'companion',
    'evidence',
    'minimal',
    'growth',
    'developer',
];
/** The emphasis id used when the user turns the optional ambition on. */
export const DEFAULT_AMBITION = 'visual';
export const AMBITION_SPECS = {
    visual: {
        id: 'visual',
        name: '视觉爆炸',
        emoji: '💥',
        summary: '不计成本做视觉：构图、动效、层次与品牌记忆点。',
        philosophy: '视觉爆炸：不计成本地打磨视觉。先定主题与品牌记忆点，再做层次构图、动效与一致性；每个界面都要有第一眼冲击力，动效服务信息层级而不是装饰；涉及 UI 的任务必须包含视觉打磨与一致性验收。',
    },
    companion: {
        id: 'companion',
        name: '陪伴养成',
        emoji: '🌱',
        summary: '角色成长、习惯回路与长期陪伴感。',
        philosophy: '陪伴养成：以角色成长、解锁与习惯回路留住用户；每次交互都要有可感知的进度与回应；不做一次性炫技，优先可持续的日常陪伴。',
    },
    evidence: {
        id: 'evidence',
        name: '数据背书',
        emoji: '📊',
        summary: '用真实数据、报表与可复核指标说话。',
        philosophy: '数据背书：结论必须挂真实数据与可复核指标；关键页面提供趋势/对比/导出；禁止编造数字，口径与时间范围必须写明。',
    },
    minimal: {
        id: 'minimal',
        name: '极简高效',
        emoji: '⚪',
        summary: '去掉一切不服务任务的元素，快而清晰。',
        philosophy: '极简高效：去掉一切不服务任务的元素；信息密度与操作路径优先；视觉克制但层级清晰；任何新增都要回答"它替用户省了什么"。',
    },
    growth: {
        id: 'growth',
        name: '增长裂变',
        emoji: '🚀',
        summary: '上手路径、分享钩子与转化漏斗。',
        philosophy: '增长裂变：设计清晰的上手路径、分享钩子与转化漏斗；关键节点埋点可验证；不牺牲核心体验换取短期转化。',
    },
    developer: {
        id: 'developer',
        name: '开发者友好',
        emoji: '🛠️',
        summary: '可读 API、可跑示例与低门槛集成。',
        philosophy: '开发者友好：接口可读、错误可诊断、示例可跑；文档与代码同步；把集成成本当作核心体验来打磨。',
    },
};
/** Is this value a stored ambition id? */
export function isAmbitionId(value) {
    return typeof value === 'string' && AMBITION_IDS.includes(value);
}
/** Resolve a spec; unknown/missing values fall back to 视觉爆炸. */
export function getAmbitionSpec(value) {
    return AMBITION_SPECS[isAmbitionId(value) ? value : DEFAULT_AMBITION];
}
export function ambitionName(value) {
    return getAmbitionSpec(value).name;
}
/**
 * Philosophy block for the constitution. Empty when no ambition is selected,
 * so an off ambition costs nothing in any prompt.
 */
export function ambitionPhilosophyText(value) {
    if (!isAmbitionId(value))
        return '';
    const spec = AMBITION_SPECS[value];
    return '【宏愿：' + spec.emoji + ' ' + spec.name + '】\n' + spec.philosophy;
}
