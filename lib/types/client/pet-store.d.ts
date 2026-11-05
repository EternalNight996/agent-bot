import { type PetActionResult, type PetState } from '../pet-model.ts';
export declare function usePet(): PetState;
/** 结算离线时间；由宠物页挂载时和定时器调用。 */
export declare function tickPetNow(now?: number): void;
export declare function feed(): PetActionResult;
export declare function play(): PetActionResult;
export declare function pat(): PetActionResult;
export declare function rest(): PetActionResult;
/** 点击唤醒；不在睡觉时是 no-op。 */
export declare function wake(): PetActionResult;
export declare function syncTasks(completed: number): void;
