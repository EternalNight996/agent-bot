import type { AgentTeamsTranslate } from './locales.ts';
export declare function ShowcasePanel({ sessionId, teamId, teamName, t, onClose }: {
    readonly sessionId: string;
    readonly teamId: string;
    readonly teamName: string;
    readonly t: AgentTeamsTranslate;
    readonly onClose: () => void;
}): import("react").JSX.Element;
