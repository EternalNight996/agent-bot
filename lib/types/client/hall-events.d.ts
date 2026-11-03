/** Window event used by the hall overlay to open one of its content sheets. */
export declare const OPEN_HALL_SHEET_EVENT = "agent-teams:open-sheet";
/** 组队入口：只交给常驻福地打开内联「start」页，不再走右侧浮窗。 */
export declare const OPEN_HALL_START_EVENT = "agent-teams:open-start";
/** t84：外部（如右栏标签被关掉）请求把福地收起成令牌；收起逻辑仍由福地自己执行。 */
export declare const COLLAPSE_HALL_EVENT = "agent-teams:collapse-hall";
/** Sheet kinds the hall can open: wall actions, panel settings, and the 组队 wizard. */
export type HallSheetAction = 'teams' | 'board' | 'config' | 'inbox' | 'settings' | 'start' | 'ranks' | 'about';
