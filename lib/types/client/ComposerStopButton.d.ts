import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { AgentTeamsTranslate } from './locales.ts';
export declare function ComposerStopButton({ sessionId, t }: {
    readonly sessionId?: SessionId;
    readonly t: AgentTeamsTranslate;
}): import("react").JSX.Element | null;
