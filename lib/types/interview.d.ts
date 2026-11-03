/**
 * Dynamic requirement interview: the model asks its own questions (with
 * choices) instead of a fixed clarification form, then turns the answers into
 * the clarification object the founding flow consumes.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type TeamMode } from './modes.ts';
import type { ClarifyOptions } from './clarify.ts';
import type { ReferenceDefaults } from './reference-project.ts';
import type { ClarifyReference, TeamClarification } from './types.ts';
/** Reference/ambition context the interview uses to shape questions and defaults. */
export interface InterviewExtras {
    ambition?: string;
    /** Compact analyzed reference project (low priority; user edits win). */
    referenceDigest?: string;
    /** Inferred defaults the interview should offer pre-selected. */
    referenceDefaults?: ReferenceDefaults;
}
/** Durable choices carried into the clarification regardless of the model. */
export interface ClarificationExtras {
    doctrine?: string;
    ambition?: string;
    reference?: ClarifyReference;
}
export interface InterviewQuestion {
    readonly id: string;
    readonly prompt: string;
    readonly multi: boolean;
    readonly options: string[];
}
export declare function buildInterviewQuestionsPrompts(requirement: string, mode?: TeamMode, extras?: InterviewExtras): {
    system: string;
    user: string;
};
export declare function parseInterviewQuestions(raw: string): InterviewQuestion[];
/** One-shot question generation; falls back to mode-based defaults. */
export declare function generateInterviewQuestions(ctx: Context, captain: Agent, input: {
    requirement: string;
    mode?: TeamMode;
    workspaceFacts: string;
} & InterviewExtras, signal?: AbortSignal): Promise<InterviewQuestion[]>;
/** Minimal template questions when the model is unavailable. */
export declare function fallbackInterviewQuestions(mode?: TeamMode, referenceDefaults?: ReferenceDefaults): InterviewQuestion[];
export declare function buildClarificationPrompt(requirement: string, mode: TeamMode | undefined, answers: readonly {
    question: string;
    answer: string[];
}[], extras?: ClarificationExtras & {
    referenceDigest?: string;
}): {
    system: string;
    user: string;
};
/** Convert the model's interview/answer output into a valid clarification. */
export declare function clarificationFromOptions(options: ClarifyOptions, mode: TeamMode | undefined, extras?: ClarificationExtras): TeamClarification;
/** Generate the clarification from the interview answers (AI); fallback is mode defaults. */
export declare function generateClarificationFromAnswers(ctx: Context, captain: Agent, input: {
    requirement: string;
    mode?: TeamMode;
    answers: readonly {
        question: string;
        answer: string[];
    }[];
} & (ClarificationExtras & {
    referenceDigest?: string;
}), signal?: AbortSignal): Promise<TeamClarification>;
