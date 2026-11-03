import type { AgentTeamsTranslate } from './locales.ts';
export declare function LibraryPanel({ sessionId, t, onStartTeam }: {
    readonly sessionId: string;
    readonly t: AgentTeamsTranslate;
    readonly onStartTeam?: () => void;
}): import("react").JSX.Element;
