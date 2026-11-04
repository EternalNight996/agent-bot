import type { AgentTeamsTranslate } from './locales.ts';
export declare function ShowcaseBody({ sessionId, teamId, teamName, t, title, docked, onClose, onOpenWindow, onReveal }: {
    readonly sessionId: string;
    readonly teamId: string;
    readonly teamName?: string;
    readonly t: AgentTeamsTranslate;
    /** 标题：驱动网关 / 交付结果。 */
    readonly title?: string;
    /** 由右侧栏承载：铺满面板，不画弹窗边框与关闭按钮。 */
    readonly docked?: boolean;
    readonly onClose?: () => void;
    /**
     * 「新窗口打开」交给宿主：桌面端会拦截 window.open（dsh-app:// 不在
     * setWindowOpenHandler 的 http/https 白名单里），所以由调用方用
     * sidebarRight.openResource 在右栏新开一个文件标签。
     */
    readonly onOpenWindow?: (workspacePath: string) => void;
    /**
     * 「打开目标文件夹」：由宿主 Session Remote 在系统文件管理器中显示该文件。
     * 返回空串表示成功，否则是一段可展示的原因。
     */
    readonly onReveal?: (workspacePath: string) => Promise<string>;
}): import("react").JSX.Element;
/** 旧的全屏弹窗外壳；页面里优先使用右侧栏的驱动网关。 */
export declare function ShowcasePanel({ sessionId, teamId, teamName, t, onClose }: {
    readonly sessionId: string;
    readonly teamId: string;
    readonly teamName: string;
    readonly t: AgentTeamsTranslate;
    readonly onClose: () => void;
}): import("react").JSX.Element;
