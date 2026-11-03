/** 皮肤 / 角色 / 阵容 three-layer configuration center. */
import { type ReactElement } from 'react';
import type { AgentTeamsTranslate } from './locales.ts';
export declare function ConfigCenter({ t, sessionId, onFeedback }: {
    readonly t: AgentTeamsTranslate;
    readonly sessionId?: string;
    readonly onFeedback?: () => void;
}): ReactElement;
