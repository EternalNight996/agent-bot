/** 设施页 key 前缀（队长裁决 Q4）。 */
export declare const HALL_PAGE_PREFIX = "dsh-super-agent:";
/** 五张墙体设施卡对应的页面（Q4 固定命名）。 */
export declare const HALL_FACILITY_PAGES: readonly ["config", "teams", "ranks", "gear", "about"];
/** 附属页面：设置、组队向导、进度板、收件箱、藏经阁。 */
export declare const HALL_EXTRA_PAGES: readonly ["settings", "start", "board", "inbox", "library", "progress", "archive"];
export type HallPage = (typeof HALL_FACILITY_PAGES)[number] | (typeof HALL_EXTRA_PAGES)[number] | 'home';
/** 主页：像素活动面板（t17：进入本插件时中间区默认落在这里）。 */
export declare const HALL_HOME_PAGE: HallPage;
export declare const HALL_PAGES: readonly HallPage[];
export declare function hallPageId(page: HallPage): string;
export declare function hallPageFromId(id: string | null | undefined): HallPage | undefined;
/** 旧面板 kind → 页面 key（天机阁在旧代码里叫 character）。 */
export declare function hallPageForSheet(sheet: string): HallPage | undefined;
/** 页面 key → 旧面板 kind（渲染器仍按 sheet kind 分支）。 */
export declare function hallSheetForPage(page: HallPage): string;
export declare function readHallPage(): HallPage | undefined;
export declare function writeHallPage(page: HallPage | undefined): void;
/** 无记录时按「收起成令牌」处理（Q7：无记录显示令牌）。 */
export declare function readHallCollapsed(): boolean;
export declare function writeHallCollapsed(collapsed: boolean): void;
/**
 * 展开态但福地不可见时，是否需要进入「令牌兜底」等待。
 *
 * 福地常驻右栏：右栏收起成 rail（面板仍挂载、只是滑出屏幕）、切换对话导致宿主
 * 卸载、或取经队页被别的标签顶掉，都必须回落成一枚令牌，否则用户既看不到福地、
 * 也点不到任何入口。收起后点令牌会重新展开右栏。
 */
export declare function shouldArmHallFallback(input: {
    readonly collapsed: boolean;
    readonly hallVisible: boolean;
}): boolean;
export declare function setHallSidebarVisible(visible: boolean): void;
/** 右栏可见性：收起/滑出/整体隐藏都会通知福地，由它决定是否显示令牌。 */
export declare function useHallSidebarVisible(): boolean;
/** 侧栏内容宿主（右侧栏标签页里渲染）。 */
export declare const HALL_SIDEBAR_HOST = "hall-sidebar";
/** 右栏内设施页内容宿主（t29：页面内容只在侧栏内渲染，不再占用中间内容区）。 */
export declare const HALL_CONTENT_HOST = "hall-content";
export declare function registerHallHost(key: string, node: HTMLElement | null): void;
/** 宿主节点出现/消失时触发重渲染，福地组件据此建立/撤销 portal。 */
export declare function useHallHost(key: string): HTMLElement | null;
