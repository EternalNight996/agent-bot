/**
 * 佛道势力：组队时给一套预设法门（或让系统随机分配）。
 *
 * 佛道势力只是「一队法门的预设」，不改变任务模板的语义，也不发明新的角色 id：
 * 选中佛道势力后法门照常进入计划，自定义模式仍可手选 20 个法门中的任意组合。
 */
import type { AgentTeamsLocaleKey } from './locales.ts';
/** 一个佛道势力：名称/说明的 locale key + 默认法门（角色 id）。 */
export interface SectPreset {
    readonly id: string;
    readonly nameKey: AgentTeamsLocaleKey;
    readonly descKey: AgentTeamsLocaleKey;
    readonly roles: readonly string[];
}
/** 内置佛道势力；新增佛道势力只改这里。 */
export declare const SECT_PRESETS: readonly SectPreset[];
/** 按 id 找佛道势力（未知 id 返回 undefined）。 */
export declare function sectPreset(id: string): SectPreset | undefined;
/** 随机抽一个佛道势力（「系统动态分配」）。 */
export declare function randomSect(current?: string): SectPreset;
