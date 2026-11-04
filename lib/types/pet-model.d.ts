/**
 * 养成宠物（小肥鱼）的纯逻辑：等级/经验、饱食/心情/精力、离线衰减与互动。
 *
 * 这里不碰 localStorage 和 React，便于单元测试；客户端 store 只负责持久化。
 */
export type PetStage = 'fry' | 'small' | 'fat' | 'whale';
export interface PetState {
    name: string;
    xp: number;
    satiety: number;
    mood: number;
    energy: number;
    /** 上次结算时间（ms）。 */
    lastTick: number;
    /** 上次已同步的任务完成数，避免重复发经验。 */
    lastTaskCount: number;
    lastFedAt: number;
    lastPlayedAt: number;
    lastPettedAt: number;
    lastRestedAt: number;
}
export interface PetActionResult {
    readonly pet: PetState;
    readonly ok: boolean;
    /** 失败原因；ok=true 时为空。 */
    readonly reason?: 'full' | 'tired' | 'cooldown' | 'maxLevel';
}
/** 离线最多结算 12 小时，避免久未打开后数值归零。 */
export declare const OFFLINE_CAP_MS: number;
export declare const MAX_LEVEL = 50;
/** 升到下一级需要的经验（当前等级）。 */
export declare function xpForNextLevel(level: number): number;
/** 由累计经验反推等级与当前级进度。 */
export declare function levelOf(xp: number): {
    level: number;
    into: number;
    need: number;
};
export declare function stageOf(level: number): PetStage;
export declare function newPet(now?: number): PetState;
/**
 * 结算一段时间：饱食度下降、心情随饥饿加速下降、精力缓慢恢复。
 * 只按整分钟结算，离线时间截断到 12 小时。
 */
export declare function tickPet(pet: PetState, now?: number): PetState;
export declare function feedPet(pet: PetState, now?: number): PetActionResult;
export declare function playPet(pet: PetState, now?: number): PetActionResult;
export declare function patPet(pet: PetState, now?: number): PetActionResult;
export declare function restPet(pet: PetState, now?: number): PetActionResult;
/** 每完成一个团队任务发一次经验，只对增量结算。 */
export declare function syncCompletedTasks(pet: PetState, completed: number): PetState;
/** 根据当前状态挑一句台词。 */
export declare function petSpeech(pet: PetState): 'hungry' | 'bored' | 'sleepy' | 'happy';
