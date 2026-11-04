/**
 * AgentTeams for DeepSeek Harness.
 *
 * A host-plane plugin that registers the `agent_teams_*` tools and one usage
 * agent-scoped usage section. Each session keeps a stable tool set and core
 * instructions. Existing business tools cover the complete team lifecycle.
 * After installation any session can
 * run multi-agent teamwork through natural language (e.g. "use AgentTeams to research X"):
 * the model creates a team (it becomes the captain), spawns members as
 * durable continuable subagents, breaks the goal into tasks with
 * dependencies, wakes members with messages, relays reports, and collects
 * results.
 *
 * Installation (bundle): `dsh plugin --profile <name> add dsh-super-agent`
 * (or a local path). The bundle patch mounts this plugin row into the host
 * composition; the tools register into the shared `tools` registry and the
 * usage section into the global system prompt, so the plugin needs no realm.
 *
 * @module dsh-agent-teams
 */
import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { haltTeamWork, soloExecutionContext, stagedPlanApprovedContext, registerAgentTeamsTools, teamLockKey, } from "./tools.js";
import { installAgentTeamsGestureBoundary, registerAgentTeamsCommand } from "./command.js";
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleTeamSnapshot, collectArchivedTeamsActivity, collectTeamsActivity } from "./snapshot.js";
import { isInterruptedTask } from "./interruptions.js";
import { clearResumeCheckpoint, readResumeCheckpoint, writeResumeCheckpoint } from "./resume-checkpoint.js";
import { archiveTeamDir, canDeclareDelivery, cancelUnfinishedTask, findTeamByCaptain, invalidateTaskAttempt, readTeam, unsatisfiedDependencies, withTeamLock, writeTeam } from "./state.js";
import { interruptMember, resolveMemberLlmSelection } from "./members.js";
import { planPreemptHandover } from "./preempt.js";
import { auditTeamWorkspace } from "./workspace-audit.js";
import { digestWorkspacePaths } from "./artifacts.js";
import { deliveryArtifactPaths } from "./quality-gates.js";
import { selectCleanupCandidates } from "./cleanup.js";
import { leadIdentityOfAsync } from "./lineage.js";
import { formatProfilesForPrompt } from "./profiles.js";
import { agencyRole } from "./agency-roles.js";
import { assignRequirementCoverage, buildPlanFromSpecs, buildQuickStartPlan, planSourceOf, quickStartAcceptance, quickStartDeliveryDefaults, quickStartRoles, ROLE_NAMES, soloPlan, stageQuickStartTeam, withRolePromptDefaults } from "./quick-start.js";
import { generatePlanSpecs } from "./plan-generator.js";
import { confinePlanToProject, derivePlatformPaths, projectRootFor } from "./project-boundary.js";
import { syncArchitectureFile } from "./architecture-file.js";
import { normalizeClarification } from "./clarify.js";
import { analyzeReference, clarifyReferenceOf, classifyReference, referenceDigest as referenceDigestText } from "./reference-project.js";
import { layerReferenceDefaults, normalizeFoundingCorrections, readFoundingBag, rememberFounding } from "./founding-bag.js";
import { DEFAULT_DOCTRINE, isDoctrineId } from "./doctrine.js";
import { factionById, factionRoleNames, isFactionId } from "./factions.js";
import { isAmbitionId } from "./ambition.js";
import { polishRequirement } from "./polish.js";
import { generateClarifyOptions } from "./clarify-options.js";
import { generateClarificationFromAnswers, generateInterviewQuestions } from "./interview.js";
import { DEFAULT_MODE, getModeSpec, isTeamMode } from "./modes.js";
import { probeMemory } from "./memory.js";
import { projectLibraryTeam } from "./library-projection.js";
import { buildShowcase, parseShowcaseFilePath, resolveShowcaseAsset, rewriteShowcaseHtml } from "./showcase.js";
import { mergeCostEntries, readCostLogEntries, readTodayCost, resolveCostDecision, todayCostFromEntries } from "./cost.js";
import { subscribeCostPrompt, subscribeLibraryChange } from "./events-bus.js";
import { buildVerifierScript, detectLegacyRegressionCommand, splitAcceptance } from "./verifier-script.js";
import { parseToolPolicies } from "./tool-policies.js";
import { installTeamCapabilities } from "./capabilities.js";
import { agentTeamsSource, observedSessionFormatVersion } from "./harness-compat.js";
import { TEAM_TOOL_NAMES } from "./tool-names.js";
import { authenticatedWebRoutes, readJsonRequest, RequestBodyError } from "./web-routes.js";
/** Web-server service key candidates, newest first. */
const WEB_SERVER_KEYS = ['webServer', 'httpServer'];
/** Mount point of delivered-artifact previews (session/team prefixed on the wire). */
const SHOWCASE_FILE_ROUTE = '/plugins/dsh-super-agent/showcase/file';
/** Workspace registry service key candidates, newest first. */
const WORKSPACE_KEYS = ['workspaceRegistry', 'workspace'];
export const name = 'agent-teams';
export const inject = ['tools', 'llm', 'subagents', 'systemPrompt', 'agents'];
// `z.object()` has an implicit `{}` default in Schemastery.  Fallback routes
// are optional, so model absence explicitly; otherwise a missing route is
// validated as an empty object and fails on the required provider/model keys.
const fallbackRouteConfig = z.union([
    z.object({ provider: z.string().required(), model: z.string().required() }),
    z.const(undefined),
]);
// Same Schemastery defaulting trap for a tool policy: an `allow`-only policy
// would materialize `deny: []` and fail a `.min(1)` on an absent list. Model
// each accepted combination explicitly, so a policy that declares only one
// side stays valid while an empty side is still rejected.
const toolPolicyConfig = z.union([
    z.object({ allow: z.array(z.string()).min(1).required(), deny: z.const(undefined) }),
    z.object({ allow: z.const(undefined), deny: z.array(z.string()).min(1).required() }),
    z.object({ allow: z.array(z.string()).min(1).required(), deny: z.array(z.string()).min(1).required() }),
]);
export const Config = z.object({
    stateDir: z.string().default('.agent-teams'),
    memberProvider: z.string().default('spawn'),
    memberAgentProviders: z.dict(z.string()).default({}),
    memberModel: z.string(),
    memberLlmProvider: z.string(),
    executionPrompt: z.string(),
    fallback: fallbackRouteConfig,
    profiles: z.dict(z.object({
        description: z.string(),
        protocol: z.string(),
        executionPrompt: z.string(),
        fallback: fallbackRouteConfig,
        members: z.array(z.object({
            name: z.string().required(),
            role: z.string(),
            agent: z.string(),
            provider: z.string(),
            model: z.string(),
            reasoning_effort: z.string(),
            executionPrompt: z.string(),
            fallback: fallbackRouteConfig,
            // Owner-declared tool-policy id this profile member selects (#59).
            tool_policy: z.string(),
        })).min(1).required(),
        taskPlanning: z.union([z.const('captain'), z.const('seed')]),
        reviewPolicy: z.object({
            requirementsMinRounds: z.natural().min(1),
            requirementsMaxRounds: z.natural().min(1),
            codeMaxRounds: z.natural().min(1),
            maxRepairAttempts: z.natural().min(1),
            requiredReviewers: z.array(z.string()),
        }),
        tasks: z.array(z.object({
            id: z.string().required(),
            subject: z.string().required(),
            description: z.string(),
            assignee: z.string(),
            dependencies: z.array(z.string()),
        })),
    })).default({}),
    toolPolicies: z.dict(toolPolicyConfig).default({}),
    memberMaxDepth: z.natural().default(0),
    maxMembers: z.natural().min(1).default(8),
    promptSectionOrder: z.natural().default(117),
    slashCommand: z.boolean().default(true),
    clarify: z.union([z.object({ enforce: z.boolean() }), z.const(undefined)]),
    memory: z.union([z.object({ endpoint: z.string() }), z.const(undefined)]),
    cost: z.union([
        z.object({
            enabled: z.boolean().default(true),
            perTaskUsd: z.number().default(3),
            perDayUsd: z.number().default(50),
            usage: z.union([z.const('actual'), z.const('estimate')]).default('actual'),
            pricing: z.union([
                z.object({
                    inputPer1k: z.union([z.number(), z.const(undefined)]),
                    outputPer1k: z.union([z.number(), z.const(undefined)]),
                    cacheReadPer1k: z.union([z.number(), z.const(undefined)]),
                    cacheWritePer1k: z.union([z.number(), z.const(undefined)]),
                    models: z.dict(z.object({
                        inputPer1k: z.union([z.number(), z.const(undefined)]),
                        outputPer1k: z.union([z.number(), z.const(undefined)]),
                        cacheReadPer1k: z.union([z.number(), z.const(undefined)]),
                        cacheWritePer1k: z.union([z.number(), z.const(undefined)]),
                    })).default({}),
                }),
                z.const(undefined),
            ]),
        }),
        z.const(undefined),
    ]),
    watchdog: z.union([z.object({
            timeoutMs: z.natural().default(900_000),
            intervalMs: z.natural().default(60_000),
        }), z.const(undefined)]),
    boundary: z.union([z.object({ productsDir: z.string(), forbidden: z.array(z.string()) }), z.const(undefined)]),
    quality: z.union([
        z.object({
            autoVerify: z.boolean().default(true),
            autoReview: z.boolean().default(false),
            crossModelReview: z.boolean().default(false),
            commands: z.array(z.string()).default(['git diff --check']),
            commandsByProject: z.dict(z.array(z.string())).default({}),
            verifyTimeoutMs: z.natural().default(120000),
            requireAcceptance: z.boolean().default(true),
            autoDetect: z.boolean().default(true),
            reviewMode: z.union([z.const('auto'), z.const('human')]).default('auto'),
        }),
        z.const(undefined),
    ]),
});
/** The model-facing usage policy: when and how to drive AgentTeams. */
export function usageSectionText(toolNames, profilesText = '') {
    return `AgentTeams captain protocol:
1. Inspect current team state when needed, using agent_teams_status. Continue existing work without duplicating its roster/tasks. Create only when no current team exists, with the user's goal as description and approval="required"; automatic approval requires an explicit request to run immediately. Staged plans never spawn or schedule work.
2. Add each needed role once; members inherit your model route unless another is requested/needed. A requested profile goes to create({profile}); it supplies its roster. Seed profiles also supply tasks; captain-planning profiles require your DAG. Do not duplicate either. A member may also select one owner-declared tool policy by id (tool_policy on add_member, a plan member, or a profile member): it is the only way to change which global tools that member sees and may invoke, and you can never pass raw allow/deny lists.
3. Build the complete smallest useful DAG while staged. For an ordinary research/audit plan, pass the roster and dependency graph together in create({plan:{members,tasks}}) to avoid repeated setup rounds. Every task needs a subject; pass kind and assignee explicitly when the plan specifies them. Titles, descriptions and member roles do not set these fields. Dependencies represent prerequisites. Give every required contributor a task or explicit message. Present the plan and end your turn for review; never approve in that planning turn. Approve only after a later explicit user approval or the Web action.
4. Respect Web approve/return/discard control messages. On return, ask what to change before editing; after the answer, use one atomic agent_teams_edit_plan batch (edit downstream references before removals), summarize and await review again. Never inspect or edit .agent-teams state files or plugin source code to revise plans. Discard does not authorize a replacement.
5. The scheduler dispatches ready tasks after approval. Delegate; do not duplicate slow work or send messages merely to start a stage. Handle reports/user work, then yield when waiting is all that remains: reports wake you automatically. Use status after a delivery or user request, never busy-poll or wait for unassigned members.
6. Tasks carry attempt_id capabilities. Use the current attempt_id; stale means ownership changed. Pause members only on explicit request; later guidance via send_message continues that same attempt. Retry, transfer or take over through reassign_task first; it revokes the old attempt and waits for quiescence. Prefer a member. Captain implementation/review takeover requires a user request. Every takeover is one ready task at a time, finished in this turn; never yield with captain-owned work open.
7. In a running team, correct never-started pending tasks with edit_plan update_task; preserve dependency and ownership contracts instead of cancelling and recreating the graph. A captain can cancel a never-started pending task directly. Active attempts still require reassign_task. Quality kinds (requirements, implementation, verification, review, repair, integration) require objective + acceptance; implementation/repair also require inScope + verify. Derive paths/commands from the workspace/profile, never assume src/ or pnpm test. Review/requirements complete only with verdict=pass; needs_revision/reject fail with findings. Delivery requires at least one completed review with verdict=pass, including work-only plans; add a review task if the plan lacks one. The host re-runs declared verify commands when a quality task completes and checks implementation/repair changedPaths against the real git diff; a failure or invented path rejects the update, so self-reported passes are not delivery evidence. Never approve your own implementation or ask for a deliberate failure. When a quality contract itself is wrong (a verify command that cannot pass, an inScope that forbids the file the objective requires), fix it with agent_teams_amend_task — captain-only, non-terminal tasks only, frozen after a passing review, and every amendment is recorded in the task's revisions ledger — instead of letting the worker dead-lock or game the gate.
8. When full quality mode is requested: requirements → implementation → verification → review → integration. Plan the entire DAG while staged, including implementation before requirements finishes and integration depending on review round 1. Failed review automatically adds repair + next review and rewires pending downstream gates. Do not recreate this loop, omit integration or depend on a failed task. Review acceptance judges the latest implementation. Do not put smoke-test scripts into task instructions.
9. Halted means the user stopped work (including the captain turn). Resume only on a later explicit user request with a reason, via agent_teams_resume or create_task({resume:true,resumeReason}); creating tasks alone never resumes. Escalated means the review loop hit its limit, not a halt. Deployment requires explicit user confirmation.
10. Wait for all required tasks to be terminal and members idle/ready, then delete/archive unless the user wants to continue. Never discard unfinished work without authorization. Delivery means shown, not described: when every task is complete the library (法脉·藏经阁) presents the delivered artifacts in place (交付展示), and a page is rendered there — never answer with "run this command / open this file yourself", and never make the user build or start the product to see it.
11. Before generating a DAG, confirm the blocking clarification with the user (agent_teams_clarify): type, plain-language scale, UI, platforms, hardware candidates, exclusions, and executable acceptance. Pass the confirmed object to agent_teams_create as clarification; a plan without it is incomplete.
12. Members may call agent_teams_memory_recall with the constitution memory_hints. A failed recall means the vault is unavailable, not that the memory is empty.
13. Every team has a development mode. The founding UI offers draft (快速体验, default), precision (标准交付) and compliance (严格交付); legacy/monetize remain accepted compatibility values for stored or advanced teams but are not offered in the main UI. The mode drives the member philosophy, default boundaries, acceptance baseline, verifier strategy and budget; persist it on the clarification and never silently change it after approval.
14. Work inside the approved contract. When a detail is ambiguous, choose the most conservative reversible option consistent with the goal, inScope, acceptance and verify commands, record the assumption in the task output, and continue. Pause and ask the user only when the next action is irreversible, outside inScope, needs credentials, or would change the approved goal. Batch questions: one blocking question with your recommended default, never a stream of confirmations.
15. If this session already has an active host Goal, treat it as the outer completion condition: do not create a second goal and do not duplicate the host Goal Round Driver's continuation. When delivery.ok is true and the goal describes this delivery, call update_goal complete; otherwise report and leave the goal alone. Never resume a disarmed goal without an explicit human request.
Tools: ${toolNames}${profilesText === '' ? '' : `\n\n${profilesText}`}`;
}
/**
 * Reference context shared by the interview routes.
 *
 * The bag's cached profile is reused for the same input so opening the
 * interview twice does not re-fetch GitHub; a fresh input is analyzed with a
 * short deadline, and any failure is a warning the UI can display rather than
 * a dead end.
 */
async function resolveReferenceContext(workspace, payload) {
    const raw = typeof payload['reference'] === 'string'
        ? payload['reference']
        : typeof payload['reference'] === 'object' && payload['reference'] !== null && typeof payload['reference']['input'] === 'string'
            ? payload['reference']['input']
            : '';
    const input = raw.trim();
    if (input === '')
        return {};
    try {
        const remembered = await readFoundingBag(workspace);
        const profile = remembered?.reference?.input === input && remembered.reference.profile !== undefined
            ? remembered.reference.profile
            : await analyzeReference(workspace, input, { timeoutMs: 8_000 });
        return { profile, digest: referenceDigestText(profile), defaults: profile.inferred };
    }
    catch (error) {
        return { warning: error instanceof Error ? error.message : String(error) };
    }
}
/** Compact workspace facts handed to the polish model; never the full tree. */
async function describeWorkspaceFacts(workspace) {
    try {
        const entries = await readdir(workspace, { withFileTypes: true });
        const dirs = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name + '/').slice(0, 20);
        const files = entries.filter(entry => entry.isFile()).map(entry => entry.name).slice(0, 20);
        let scripts = '';
        try {
            const pkg = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'));
            scripts = Object.keys(pkg.scripts ?? {}).join(', ');
        }
        catch { /* no package.json */ }
        return ['workspace: ' + workspace, 'dirs: ' + dirs.join(' '), 'files: ' + files.join(' '), scripts === '' ? '' : 'scripts: ' + scripts]
            .filter(line => line !== '')
            .join('\n');
    }
    catch {
        return 'workspace: ' + workspace;
    }
}
const ARTIFACT_EXTENSIONS = new Set(['.html', '.py', '.exe', '.bat', '.cmd', '.rs']);
const ARTIFACT_SKIP = new Set(['target', 'node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build']);
function artifactKind(ext) {
    if (ext === '.html')
        return 'web';
    if (ext === '.py')
        return 'python';
    if (ext === '.exe')
        return 'exe';
    if (ext === '.bat' || ext === '.cmd')
        return 'batch';
    if (ext === '.rs')
        return 'rust';
    return undefined;
}
async function listDeliveryArtifacts(root, prefix = '', depth = 0) {
    if (depth > 4)
        return [];
    let entries;
    try {
        entries = await readdir(join(root, prefix), { withFileTypes: true });
    }
    catch {
        return [];
    }
    const found = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.'))
            continue;
        const rel = prefix === '' ? entry.name : prefix + '/' + entry.name;
        if (entry.isDirectory()) {
            if (ARTIFACT_SKIP.has(entry.name))
                continue;
            found.push(...await listDeliveryArtifacts(root, rel, depth + 1));
            continue;
        }
        const ext = extname(entry.name).toLowerCase();
        const kind = artifactKind(ext);
        if (kind !== undefined)
            found.push({ path: rel, name: entry.name, ext, kind });
        else if (entry.name === 'Cargo.toml')
            found.push({ path: rel, name: entry.name, ext: '.toml', kind: 'rust' });
    }
    return found;
}
function safeArtifactPath(root, rel) {
    const abs = resolve(root, rel);
    const normalizedRoot = resolve(root);
    if (abs !== normalizedRoot && !abs.toLowerCase().startsWith(normalizedRoot.toLowerCase() + '\\')) {
        throw new Error('artifact path escapes the project root');
    }
    return abs;
}
function launchShowcaseAction(workspace, action) {
    if (action.kind === 'preview')
        return { ok: true, preview: true };
    if (action.command === undefined)
        throw new Error('delivery action has no command');
    const command = action.command.includes('/') || action.command.includes('\\')
        ? resolve(workspace, action.command)
        : action.command;
    const cwd = action.cwd === undefined ? workspace : resolve(workspace, action.cwd);
    const child = spawn(command, [...(action.args ?? [])], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return { ok: true, pid: child.pid };
}
function launchArtifact(abs) {
    const ext = extname(abs).toLowerCase();
    if (ext === '.html')
        return { ok: true, preview: true };
    let command = abs;
    let args = [];
    let cwd = dirname(abs);
    if (ext === '.py') {
        command = 'python';
        args = [abs];
    }
    else if (ext === '.bat' || ext === '.cmd') {
        command = 'cmd.exe';
        args = ['/c', abs];
    }
    else if (ext === '.ps1') {
        command = 'powershell.exe';
        args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs];
    }
    else if (ext === '.rs' || ext === '.toml') {
        command = 'cargo';
        args = ['run'];
        cwd = dirname(abs);
    }
    const child = spawn(command, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return { ok: true, pid: child.pid };
}
export function apply(ctx, config) {
    const resolved = {
        stateDir: config.stateDir ?? '.agent-teams',
        memberProvider: config.memberProvider ?? 'spawn',
        memberAgentProviders: config.memberAgentProviders ?? {},
        memberModel: config.memberModel,
        memberLlmProvider: config.memberLlmProvider,
        executionPrompt: config.executionPrompt,
        fallback: config.fallback,
        memberMaxDepth: config.memberMaxDepth ?? 0,
        maxMembers: config.maxMembers ?? 8,
        profiles: config.profiles ?? {},
        // Owner configuration is validated once, at mount: an empty or malformed
        // policy must never reach a member creation path.
        toolPolicies: parseToolPolicies(config.toolPolicies),
        clarify: config.clarify,
        memory: config.memory,
        cost: config.cost,
        watchdog: config.watchdog,
        quality: config.quality,
    };
    // Provider registration is a sibling plugin's effect (`subagent-spawn` /
    // `subagent-fork` rows), which can land after this mount under the Loader's
    // concurrent activation — so capability validation happens at the first
    // member spawn (`spawnMember`), the earliest point the provider list is
    // settled, rather than here.
    const agentTeamsRuntime = registerAgentTeamsTools(ctx, resolved);
    installTeamCapabilities(ctx, {
        stateDir: resolved.stateDir,
        isPendingMember: agentTeamsRuntime.isPendingMember,
        order: config.promptSectionOrder,
        // Keep the bounded profile directory available without extra tool calls.
        // installTeamCapabilities snapshots this once; no business state rewrites it.
        captainPrompt: () => usageSectionText(TEAM_TOOL_NAMES.join(', '), formatProfilesForPrompt(config.profiles)),
    });
    // Deterministic activation surfaces: the closed-namespace `/agent-teams`
    // host command (surfaces in the Web GUI slash menu via the Harness
    // ui-commands client) and the plain-text gesture boundary for surfaces
    // without command adjudication (headless CLI). Both default on; a profile
    // can disable them to keep the natural-language trigger exclusive.
    //
    // `commands` is registered lazily (not a required inject): it ships in the
    // base bundle of every standard profile, but a minimal composition that
    // omits the command registry keeps the plugin fully functional — the fiber
    // never pends on it and simply never gains the slash command.
    if (config.slashCommand ?? true) {
        ctx.inject(['commands'], (commandCtx) => {
            registerAgentTeamsCommand(commandCtx, () => config.profiles ?? {});
        });
        installAgentTeamsGestureBoundary(ctx, () => config.profiles ?? {});
    }
    // The activity panel data/artwork routes need the Web server and the
    // workspace registry, which headless profiles do not mount; under
    // concurrent activation they may also bind after this plugin. Register the
    // routes lazily: try now, then on each service binding event. In a webless
    // profile the plugin stays tool-only and never blocks boot.
    let webRegistered = false;
    const registerWebSurface = () => {
        if (webRegistered)
            return;
        const rawWebServer = (ctx.get(WEB_SERVER_KEYS[0]) ?? ctx.get(WEB_SERVER_KEYS[1]));
        const workspaceRegistry = (ctx.get(WORKSPACE_KEYS[0]) ?? ctx.get(WORKSPACE_KEYS[1]));
        if (rawWebServer === undefined || workspaceRegistry === undefined)
            return;
        const webServer = authenticatedWebRoutes(rawWebServer, () => ctx.get('connection'));
        webRegistered = true;
        // Activity panel data route: the browser floater polls this for team
        // snapshots (disk truth + live subagent activity). Mirrors the Claude
        // Code desktop watcher's server-side snapshot pattern.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/state',
            handler: async (req, res) => {
                const url = new URL(req.url ?? '/', 'http://x');
                const roots = workspaceRegistry.list().map((workspace) => ({
                    workspace: workspace.title,
                    // The panel audits the same current bytes as agent_teams_status, so it
                    // cannot advertise a passing gate over a changed revision (#161).
                    workspacePath: workspace.path,
                    stateRoot: join(workspace.path, resolved.stateDir),
                }));
                // ?archived=1 serves teams moved to archive/ (post-delete review).
                const snapshots = url.searchParams.get('archived') === '1'
                    ? await collectArchivedTeamsActivity(ctx, roots)
                    : await collectTeamsActivity(ctx, roots);
                const body = JSON.stringify({ teams: snapshots });
                res.writeHead(200, {
                    'content-type': 'application/json; charset=utf-8',
                    'cache-control': 'no-store',
                });
                res.end(body);
            },
        }), 'agent-teams: activity route');
        // Task-scoped skill catalog. The host owns discovery; the plugin only
        // exposes model-invocable entries for the task editor.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/skills',
            handler: async (req, res) => {
                const url = new URL(req.url ?? '/', 'http://x');
                const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const registry = ctx.skills;
                try {
                    const entries = registry === undefined ? [] : await registry.list({
                        cwd: captain.session.header.cwd ?? process.cwd(),
                        scope: captain,
                    });
                    const skills = entries
                        .filter((entry) => entry['modelInvocable'] !== false)
                        .map((entry) => ({
                        name: String(entry['name'] ?? ''),
                        description: String(entry['description'] ?? ''),
                        provider: String(entry['provider'] ?? ''),
                    }))
                        .filter((entry) => entry.name !== '');
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ skills }));
                }
                catch (error) {
                    ctx.logger.warn('agent-teams: skill catalog failed: ' + String(error));
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'skill catalog unavailable' }));
                }
            },
        }), 'agent-teams: skills route');
        // Role prompt body for the role editor. The browser bundle carries role
        // metadata only, so the editor pulls the one prompt body it opens instead
        // of every client paying ~1 MB of prompt text at load time.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/role-prompt',
            handler: async (req, res) => {
                const url = new URL(req.url ?? '/', 'http://x');
                const roleId = url.searchParams.get('roleId')?.trim() ?? '';
                const prompt = roleId === '' ? undefined : agencyRole(roleId)?.prompt;
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({ roleId, prompt: prompt ?? '' }));
            },
        }), 'agent-teams: role prompt route');
        // Module 3: push the library projection over SSE. It reads the same durable
        // team record every other surface reads — no polling, no second state store.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/events',
            handler: async (req, res) => {
                const url = new URL(req.url ?? '/', 'http://x');
                const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                res.writeHead(200, {
                    'content-type': 'text/event-stream; charset=utf-8',
                    'cache-control': 'no-store',
                    connection: 'keep-alive',
                });
                res.write(': connected\n\n');
                let closed = false;
                const send = (event, data) => {
                    if (closed)
                        return;
                    try {
                        res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
                    }
                    catch {
                        closed = true;
                    }
                };
                const emit = async () => {
                    if (closed)
                        return;
                    try {
                        const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                        const today = await readTodayCost(workspace);
                        send('library', { team: team === undefined ? null : projectLibraryTeam(team, today), todayCostUsd: today });
                    }
                    catch (error) {
                        send('error', { message: error instanceof Error ? error.message : String(error) });
                    }
                };
                void emit();
                const offTeams = subscribeLibraryChange((root) => { if (root === stateRoot)
                    void emit(); });
                const offCost = subscribeCostPrompt((prompt) => { if (prompt.sessionId === captain.id)
                    send('cost', prompt); });
                const heartbeat = setInterval(() => {
                    if (closed)
                        return;
                    try {
                        res.write(': ping\n\n');
                    }
                    catch {
                        closed = true;
                    }
                }, 15_000);
                const cleanup = () => {
                    if (closed)
                        return;
                    closed = true;
                    offTeams();
                    offCost();
                    clearInterval(heartbeat);
                    try {
                        res.end();
                    }
                    catch { /* already closed */ }
                };
                req.on('close', cleanup);
                res.on('close', cleanup);
            },
        }), 'agent-teams: library events route');
        // Delivery showcase: the library lists what a finished team produced and
        // previews it in place. This is the product rule that a delivery is shown,
        // never handed over as "run this command yourself".
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/showcase',
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const url = new URL(req.url ?? '/', 'http://x');
                const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                try {
                    const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                    if (team === undefined) {
                        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'no active team for this session' }));
                        return;
                    }
                    const view = buildShowcase(workspace, team);
                    const mount = SHOWCASE_FILE_ROUTE + '/' + encodeURIComponent(captain.id) + '/' + encodeURIComponent(team.id) + '/';
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, ...view, mount }));
                }
                catch (error) {
                    ctx.logger.warn('agent-teams: showcase failed: ' + String(error));
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'showcase unavailable' }));
                }
            },
        }), 'agent-teams: showcase route');
        // Run a delivered executable/script from the showcase. HTML stays a preview;
        // Python/Rust/batch/exe are launched detached from the same workspace root.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/showcase/run',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                const artifactPath = typeof payload.path === 'string' ? payload.path.trim() : '';
                if (sessionId === '' || teamId === '' || artifactPath === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId, teamId and path are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                try {
                    const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                    if (team === undefined || team.id !== teamId) {
                        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'delivery not found' }));
                        return;
                    }
                    const view = buildShowcase(workspace, team);
                    const action = view.actions.find(item => item.path === artifactPath);
                    if (action === undefined) {
                        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'this delivery has no stored action for that artifact' }));
                        return;
                    }
                    const resolved = resolveShowcaseAsset(workspace, team, artifactPath);
                    if (!resolved.ok) {
                        res.writeHead(resolved.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: resolved.error }));
                        return;
                    }
                    const result = launchShowcaseAction(workspace, action);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ path: artifactPath, ...result }));
                }
                catch (error) {
                    ctx.logger.warn('agent-teams: showcase run failed: ' + String(error));
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'failed to launch artifact' }));
                }
            },
        }), 'agent-teams: showcase run route');
        // Reveal one delivered artifact in the OS file manager. The path must
        // already resolve inside the showcase, and the folder is the artifact's
        // own directory — never an arbitrary path from the request.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/reveal-artifact',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                const artifactPath = typeof payload.path === 'string' ? payload.path.trim() : '';
                if (sessionId === '' || teamId === '' || artifactPath === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId, teamId and path are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                try {
                    const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                    if (team === undefined || team.id !== teamId) {
                        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'delivery not found' }));
                        return;
                    }
                    const resolved = resolveShowcaseAsset(workspace, team, artifactPath);
                    if (!resolved.ok) {
                        res.writeHead(resolved.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: resolved.error }));
                        return;
                    }
                    const folder = dirname(resolved.asset.absolutePath);
                    const command = process.platform === 'win32' ? 'explorer.exe'
                        : process.platform === 'darwin' ? 'open' : 'xdg-open';
                    const args = process.platform === 'win32'
                        ? ['/select,', resolved.asset.absolutePath]
                        : process.platform === 'darwin' ? ['-R', resolved.asset.absolutePath] : [folder];
                    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false });
                    child.unref();
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, folder }));
                }
                catch (error) {
                    ctx.logger.warn('agent-teams: showcase reveal failed: ' + String(error));
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'failed to reveal artifact' }));
                }
            },
        }), 'agent-teams: showcase reveal route');
        // Artifact bytes for the showcase preview. Session and team live in the
        // path, not only the query, so a page's relative script/style/image
        // references stay inside the same authenticated mount.
        ctx.effect(() => webServer.register({
            kind: 'prefix',
            path: SHOWCASE_FILE_ROUTE,
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const url = new URL(req.url ?? '/', 'http://x');
                const pathname = url.pathname;
                const target = parseShowcaseFilePath(pathname, SHOWCASE_FILE_ROUTE);
                if (target === undefined) {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId, teamId and a valid artifact path are required' }));
                    return;
                }
                const { sessionId, teamId } = target;
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                try {
                    const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                    // The team id in the path pins the preview to the delivery it was
                    // rendered for: after a new team replaces it, an old page 404s
                    // instead of silently showing the new team's files.
                    if (team === undefined || team.id !== teamId) {
                        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'delivery not found' }));
                        return;
                    }
                    const resolved = resolveShowcaseAsset(workspace, team, target.path);
                    if (!resolved.ok) {
                        res.writeHead(resolved.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: resolved.error }));
                        return;
                    }
                    const headers = {
                        'content-type': resolved.asset.html ? 'text/html; charset=utf-8' : resolved.asset.mediaType,
                        'cache-control': 'no-store',
                        'x-content-type-options': 'nosniff',
                        'content-disposition': 'inline',
                        // The preview frame is sandboxed without same-origin, so the page's
                        // own module scripts are cross-origin fetches even though the URL
                        // matches. Artifacts are read-only GETs from the user's workspace.
                        'access-control-allow-origin': '*',
                    };
                    if (resolved.asset.html) {
                        const source = await readFile(resolved.asset.absolutePath, 'utf8');
                        const body = rewriteShowcaseHtml(source, pathname.slice(0, pathname.lastIndexOf('/') + 1));
                        res.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(body) });
                        res.end(body);
                        return;
                    }
                    res.writeHead(200, { ...headers, 'content-length': resolved.asset.size });
                    const stream = createReadStream(resolved.asset.absolutePath);
                    stream.on('error', (error) => {
                        ctx.logger.warn('agent-teams: showcase stream failed: ' + String(error));
                        res.destroy();
                    });
                    stream.pipe(res);
                }
                catch (error) {
                    ctx.logger.warn('agent-teams: showcase artifact failed: ' + String(error));
                    if (!res.headersSent) {
                        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'artifact unavailable' }));
                    }
                    else {
                        res.destroy();
                    }
                }
            },
        }), 'agent-teams: showcase file route');
        // Module 4: the browser's answer to one cost prompt. An expired prompt is a
        // 404, never a spawn failure.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/cost/decision',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
                const decision = payload.decision === 'continue' ? 'continue' : payload.decision === 'terminate' ? 'terminate' : undefined;
                if (requestId === '' || decision === undefined) {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'requestId and decision (continue|terminate) are required' }));
                    return;
                }
                const resolved = resolveCostDecision(requestId, decision);
                res.writeHead(resolved ? 200 : 404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify(resolved ? { ok: true, decision } : { error: 'cost prompt is no longer pending' }));
            },
        }), 'agent-teams: cost decision route');
        // Cost ledger for the roster/name-list: today's spend, per-task totals and
        // the latest entries, all read from .pixel-team/cost-log.jsonl.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/cost/report',
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const url = new URL(req.url ?? '/', 'http://x');
                const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const teamFilter = url.searchParams.get('teamId')?.trim() ?? '';
                // The desktop session workspace and the profile directory can differ
                // (older teams logged costs next to the profile). Merge known roots so
                // 名册 still finds the real spend instead of showing an empty ledger.
                const roots = [...new Set([
                        workspace,
                        process.env.DSH_PROFILE_DIR ?? '',
                        process.env.DSH_HOME ?? '',
                    ].filter(root => root !== ''))];
                const allEntries = mergeCostEntries((await Promise.all(roots.map(root => readCostLogEntries(root)))).flat());
                // A task with actual usage supersedes its provisional spawn estimate.
                // Spawn estimates often carry no taskId, so also drop every estimate for
                // a team that already reported actual usage — otherwise the same work is
                // billed twice and the ledger reads several times the real spend.
                const actualKeys = new Set(allEntries.filter(entry => entry.decision === 'usage-actual').map(entry => `${entry.teamId ?? ''}|${entry.taskId ?? ''}`));
                const teamsWithActual = new Set(allEntries.filter(entry => entry.decision === 'usage-actual').map(entry => entry.teamId ?? ''));
                const effectiveAll = allEntries.filter(entry => entry.decision === 'usage-actual'
                    || (!teamsWithActual.has(entry.teamId ?? '') && !actualKeys.has(`${entry.teamId ?? ''}|${entry.taskId ?? ''}`)));
                const entries = teamFilter === '' ? effectiveAll : effectiveAll.filter(entry => entry.teamId === teamFilter);
                const todayUsd = todayCostFromEntries(effectiveAll);
                const byTask = new Map();
                const byTeam = new Map();
                let totalInputTokens = 0;
                let totalOutputTokens = 0;
                let firstTs = 0;
                let lastTs = 0;
                for (const entry of entries) {
                    const inputTokens = entry.inputTokens ?? 0;
                    const outputTokens = entry.outputTokens ?? 0;
                    const actual = entry.decision === 'usage-actual';
                    if (firstTs === 0 || entry.ts < firstTs)
                        firstTs = entry.ts;
                    if (entry.ts > lastTs)
                        lastTs = entry.ts;
                    totalInputTokens += inputTokens;
                    totalOutputTokens += outputTokens;
                    const taskKey = entry.taskId === undefined || entry.taskId === '' ? '(spawn)' : entry.taskId;
                    const task = byTask.get(taskKey) ?? { taskId: taskKey, usd: 0, count: 0, inputTokens: 0, outputTokens: 0, actual: false };
                    task.usd += entry.estimateUsd;
                    task.count += 1;
                    task.inputTokens += inputTokens;
                    task.outputTokens += outputTokens;
                    task.actual = task.actual || actual;
                    byTask.set(taskKey, task);
                    if (entry.teamId !== undefined) {
                        const team = byTeam.get(entry.teamId) ?? { teamId: entry.teamId, usd: 0, inputTokens: 0, outputTokens: 0, actual: false };
                        team.usd += entry.estimateUsd;
                        team.inputTokens += inputTokens;
                        team.outputTokens += outputTokens;
                        team.actual = team.actual || actual;
                        byTeam.set(entry.teamId, team);
                    }
                }
                const round = (value) => Math.round(value * 10000) / 10000;
                const tokenView = (item) => ({
                    input_tokens: item.inputTokens,
                    output_tokens: item.outputTokens,
                    total_tokens: item.inputTokens + item.outputTokens,
                });
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({
                    ok: true,
                    today_usd: round(todayUsd),
                    total_usd: round(entries.reduce((sum, entry) => sum + entry.estimateUsd, 0)),
                    input_tokens: totalInputTokens,
                    output_tokens: totalOutputTokens,
                    total_tokens: totalInputTokens + totalOutputTokens,
                    first_ts: firstTs === 0 ? undefined : firstTs,
                    last_ts: lastTs === 0 ? undefined : lastTs,
                    by_task: [...byTask.values()].map(item => ({ ...item, usd: round(item.usd), ...tokenView(item) })).sort((left, right) => right.usd - left.usd),
                    by_team: [...byTeam.values()].map(item => ({ ...item, usd: round(item.usd), ...tokenView(item) })).sort((left, right) => right.usd - left.usd),
                    entries: entries.slice(-60).reverse(),
                }));
            },
        }), 'agent-teams: cost report route');
        // Delivery artifacts: list, preview and one-click launch inside the library.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/artifact',
            handler: async (req, res) => {
                const method = req.method ?? 'GET';
                if (method !== 'GET' && method !== 'POST') {
                    res.writeHead(405, { allow: 'GET, POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let sessionId = '';
                let teamId = '';
                let rel = '';
                let action = 'list';
                let payload;
                if (method === 'POST') {
                    try {
                        payload = await readJsonRequest(req);
                    }
                    catch (error) {
                        res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                        return;
                    }
                    sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                    teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                    rel = typeof payload.path === 'string' ? payload.path.trim() : '';
                    action = 'run';
                }
                else {
                    const url = new URL(req.url ?? '/', 'http://x');
                    sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                    teamId = url.searchParams.get('teamId')?.trim() ?? '';
                    rel = url.searchParams.get('path')?.trim() ?? '';
                    action = url.searchParams.get('action') ?? 'list';
                }
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, resolved.stateDir);
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined || (teamId !== '' && team.id !== teamId)) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team not found for this captain' }));
                    return;
                }
                const rootRel = team.planProjectRoot ?? '';
                if (rootRel === '') {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team has no product root' }));
                    return;
                }
                const rootAbs = resolve(workspace, rootRel);
                if (action === 'list') {
                    const artifacts = await listDeliveryArtifacts(rootAbs);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, root: rootRel, artifacts }));
                    return;
                }
                let abs;
                try {
                    abs = safeArtifactPath(rootAbs, rel);
                }
                catch (error) {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid path' }));
                    return;
                }
                if (action === 'file') {
                    const ext = extname(abs).toLowerCase();
                    const types = {
                        '.html': 'text/html; charset=utf-8',
                        '.css': 'text/css; charset=utf-8',
                        '.js': 'text/javascript; charset=utf-8',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.svg': 'image/svg+xml',
                    };
                    res.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
                    createReadStream(abs).on('error', () => { try {
                        res.end();
                    }
                    catch { } }).pipe(res);
                    return;
                }
                try {
                    const result = launchArtifact(abs);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ path: rel, ...result }));
                }
                catch (error) {
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'failed to launch' }));
                }
            },
        }), 'agent-teams: artifact route');
        // Library "stop task": revoke the current attempt and mark the task failed
        // so the scheduler and downstream gates see a terminal stop.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/task/stop',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : '';
                if (sessionId === '' || taskId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and taskId are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no active team for this session' }));
                    return;
                }
                let stopped = false;
                await withTeamLock(teamLockKey(stateRoot, team.id), async () => {
                    const fresh = await readTeam(stateRoot, team.id);
                    if (fresh === undefined)
                        return;
                    const task = fresh.tasks.find(item => item.id === taskId);
                    if (task === undefined)
                        return;
                    if (task.status === 'completed' || task.status === 'failed')
                        return;
                    const assignee = task.assignee;
                    invalidateTaskAttempt(task);
                    task.assignee = assignee;
                    task.status = 'failed';
                    task.output = '用户从法脉·藏经阁停止该任务';
                    task.updatedAt = Date.now();
                    await writeTeam(stateRoot, fresh);
                    stopped = true;
                });
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({ ok: true, stopped }));
            },
        }), 'agent-teams: stop task route');
        // Composer "stop current task and start the next one": cancel the running
        // attempt (terminal, but recoverable through /resume-last), interrupt its
        // member so the old turn stops touching files, then let the scheduler claim
        // the queued task from the idle edge (plus idempotent fallback kicks).
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/task/preempt',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no active team for this session' }));
                    return;
                }
                const open = team.tasks
                    .filter(task => task.status === 'claimed' || task.status === 'in_progress')
                    .sort((left, right) => (left.status === right.status ? (left.updatedAt ?? 0) - (right.updatedAt ?? 0) : left.status === 'in_progress' ? -1 : 1));
                const target = open[0];
                if (target === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no task is running' }));
                    return;
                }
                const next = team.tasks.find(task => task.status === 'pending'
                    && task.id !== target.id
                    && unsatisfiedDependencies(team.tasks, task.dependencies).length === 0);
                const member = target.assignee === undefined ? undefined : team.members.find(item => item.name === target.assignee);
                let stopped = false;
                await withTeamLock(teamLockKey(stateRoot, team.id), async () => {
                    const fresh = await readTeam(stateRoot, team.id);
                    if (fresh === undefined)
                        return;
                    const task = fresh.tasks.find(item => item.id === target.id);
                    if (task === undefined)
                        return;
                    if (task.status !== 'claimed' && task.status !== 'in_progress')
                        return;
                    // cancelled keeps assignee/attempt/changedPaths/commandsRun so the
                    // existing isInterruptedTask + /resume-last path can restore it.
                    cancelUnfinishedTask(task, '用户从对话框叫停，准备执行新任务');
                    await writeTeam(stateRoot, fresh);
                    stopped = true;
                });
                if (!stopped) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'task already finished', stoppedTaskId: target.id }));
                    return;
                }
                if (member !== undefined && member.id !== '')
                    interruptMember(ctx, captain, member.id);
                // t67：「立刻开始」只在下一个排队任务确实能马上派出去时成立。
                // 若它的 assignee 不空闲（或未指定），而刚被中断的成员此刻已空闲，就把该排队任务改派给这个成员 ——
                // 只改任务的 assignee 字段（与既有改派一致），不动调度器、依赖语义与任务 schema。
                const memberAvailable = (candidate) => {
                    if (candidate === undefined || candidate.stopping === true)
                        return false;
                    const live = candidate.id === '' ? undefined : ctx.agents.get(candidate.id);
                    return live === undefined || live.status === 'idle';
                };
                // t67：判定是否改派 / 能否承诺立刻开始（纯函数，scripts/preempt-verify.mjs 共用同一实现）。
                const plan = planPreemptHandover({
                    next: next === undefined ? undefined : { id: next.id, assignee: next.assignee },
                    members: team.members,
                    interrupted: member,
                    isAvailable: memberAvailable,
                });
                let started = plan.started;
                let assignedTo = member?.name;
                if (plan.reassignTo !== undefined && next !== undefined) {
                    // 只改 assignee 与 updatedAt（与既有改派一致），不动 status/attempt/dependencies。
                    await withTeamLock(teamLockKey(stateRoot, team.id), async () => {
                        const fresh = await readTeam(stateRoot, team.id);
                        if (fresh === undefined)
                            return;
                        const queued = fresh.tasks.find(item => item.id === next.id);
                        if (queued === undefined || queued.status !== 'pending')
                            return;
                        const currentOwner = queued.assignee === undefined ? undefined : fresh.members.find(item => item.name === queued.assignee);
                        if (currentOwner !== undefined && !memberAvailable(currentOwner))
                            return;
                        const handover = fresh.members.find(item => item.name === plan.reassignTo);
                        if (handover === undefined || !memberAvailable(handover))
                            return;
                        queued.assignee = handover.name;
                        queued.updatedAt = Date.now();
                        await writeTeam(stateRoot, fresh);
                    });
                }
                const kick = () => { void agentTeamsRuntime.kickTeam(workspace, team.id).catch(() => undefined); };
                kick();
                setTimeout(kick, 800);
                setTimeout(kick, 2000);
                // 诊断用：下次一眼能看出是「没判定通过」还是「改派了但没被领取」。
                console.info('agent-teams: preempt decision', JSON.stringify({ stopped: target.id, next: next?.id, started, reassignTo: plan.reassignTo, queuedAssignee: next?.assignee }));
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({
                    ok: true,
                    stoppedTaskId: target.id,
                    nextTaskId: next?.id,
                    started,
                    assignedTo,
                    queuedAssignee: next?.assignee,
                    memberId: member?.id,
                }));
            },
        }), 'agent-teams: preempt task route');
        // Human confirmation for an auto-audited review (quality.reviewMode=human).
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/task/review-confirm',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : '';
                if (sessionId === '' || taskId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and taskId are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no active team for this session' }));
                    return;
                }
                try {
                    const result = await agentTeamsRuntime.confirmReview(captain, team.id, taskId);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, ...result }));
                }
                catch (error) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            },
        }), 'agent-teams: confirm review route');
        // Source data for regenerating a staged plan (same goal/clarification/roles).
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/plan/source',
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const url = new URL(req.url ?? '/', 'http://x');
                const sessionId = url.searchParams.get('sessionId')?.trim() ?? '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no active team for this session' }));
                    return;
                }
                const source = planSourceOf(team);
                if (source === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'only a staged plan can be regenerated' }));
                    return;
                }
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({ ok: true, ...source }));
            },
        }), 'agent-teams: plan source route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/halt',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                if (sessionId === '' || teamId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and teamId are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, resolved.stateDir);
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined || team.id !== teamId) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team not found for this captain' }));
                    return;
                }
                try {
                    const result = await haltTeamWork({
                        ctx,
                        stateRoot,
                        teamId,
                        captain,
                    });
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify(result));
                }
                catch (error) {
                    ctx.logger.warn(`agent-teams: halt failed for ${teamId}: ${String(error)}`);
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'failed to stop the team' }));
                }
            },
        }), 'agent-teams: halt route');
        // Human delivery acceptance. Technical delivery.ok stays a gate; acceptance
        // is the separate "the user signed off" fact the panel shows.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/delivery/accept',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                if (sessionId === '' || teamId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and teamId are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, resolved.stateDir);
                try {
                    const acceptedAt = await withTeamLock(teamLockKey(stateRoot, teamId), async () => {
                        const team = await readTeam(stateRoot, teamId);
                        if (team === undefined || team.captainSessionId !== captain.id)
                            throw new Error('team not found for this captain');
                        const check = canDeclareDelivery(team, auditTeamWorkspace(workspace, team));
                        if (!check.ok)
                            throw new Error('delivery is not ready: ' + check.blockers.join('; '));
                        if (team.acceptedAt !== undefined)
                            return team.acceptedAt;
                        const now = Date.now();
                        const digests = digestWorkspacePaths(workspace, deliveryArtifactPaths(team));
                        team.acceptedAt = now;
                        team.acceptedBy = captain.id;
                        team.acceptedDigests = Object.fromEntries(digests.map((digest) => [digest.path, digest.sha256 ?? String(digest.mtimeMs ?? 'missing')]));
                        await writeTeam(stateRoot, team);
                        return now;
                    });
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ acceptedAt }));
                }
                catch (error) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'acceptance rejected' }));
                }
            },
        }), 'agent-teams: delivery accept route');
        // Panel cleanup: archive terminal teams older than the cutoff. The current
        // captain's team is never a candidate; dry_run defaults to true.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/cleanup',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, resolved.stateDir);
                const rawDays = payload.older_than_days;
                const days = typeof rawDays === 'number' && Number.isFinite(rawDays) ? Math.min(3650, Math.max(0, Math.floor(rawDays))) : 7;
                const dryRun = payload.dry_run !== false;
                const includeArchived = payload.include_archived === true;
                const teams = [];
                try {
                    for (const entry of await readdir(stateRoot, { withFileTypes: true })) {
                        if (!entry.isDirectory() || entry.name === 'archive')
                            continue;
                        try {
                            const team = await readTeam(stateRoot, entry.name);
                            if (team !== undefined)
                                teams.push(team);
                        }
                        catch { /* skip unreadable/foreign dirs */ }
                    }
                }
                catch { /* no state root: no candidates */ }
                const candidates = selectCleanupCandidates(teams, {
                    now: Date.now(),
                    olderThanDays: days,
                    excludeCaptainSessionId: captain.id,
                });
                // The roster history is already-archived teams. "Archive" there means:
                // move those archived dirs to archive/.retired so they leave the roster.
                const archivedTeams = [];
                const archiveRoot = join(stateRoot, 'archive');
                if (includeArchived) {
                    try {
                        for (const entry of await readdir(archiveRoot, { withFileTypes: true })) {
                            if (!entry.isDirectory() || entry.name === '.retired')
                                continue;
                            try {
                                const team = await readTeam(archiveRoot, entry.name);
                                if (team !== undefined && team.captainSessionId === captain.id)
                                    archivedTeams.push({ dir: entry.name, team });
                            }
                            catch { /* skip unreadable/foreign dirs */ }
                        }
                    }
                    catch { /* no archive: nothing to retire */ }
                }
                const now = Date.now();
                const archivedCandidates = archivedTeams.map(({ dir, team }) => ({
                    id: team.id,
                    name: team.name,
                    age_days: Math.max(0, Math.floor((now - (team.createdAt ?? now)) / 86_400_000)),
                    tasks: team.tasks.length,
                    dir,
                }));
                const archived = [];
                const errors = [];
                if (!dryRun) {
                    for (const candidate of candidates) {
                        try {
                            await archiveTeamDir(stateRoot, candidate.id);
                            archived.push(candidate.id);
                        }
                        catch (error) {
                            errors.push(`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    if (includeArchived && archivedCandidates.length > 0) {
                        const retiredRoot = join(archiveRoot, '.retired');
                        try {
                            await mkdir(retiredRoot, { recursive: true });
                            for (const [index, candidate] of archivedCandidates.entries()) {
                                try {
                                    await rename(join(archiveRoot, candidate.dir), join(retiredRoot, `${candidate.dir}-${now}-${index}`));
                                    archived.push(candidate.id);
                                }
                                catch (error) {
                                    errors.push(`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
                                }
                            }
                        }
                        catch (error) {
                            errors.push(`retired: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                }
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({
                    dry_run: dryRun,
                    candidates: [
                        ...candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, age_days: candidate.ageDays, tasks: candidate.tasks })),
                        ...archivedCandidates.map((candidate) => ({ id: candidate.id, name: candidate.name, age_days: candidate.age_days, tasks: candidate.tasks })),
                    ],
                    archived,
                    ...errors.length === 0 ? {} : { errors },
                }));
            },
        }), 'agent-teams: cleanup route');
        // Panel "重新开始": resume a halted team through the same tool the captain
        // would call, so the durable state, the session event and the scheduler kick
        // stay identical to agent_teams_resume.
        // Resume the most recent interrupted/failed task without touching the rest
        // of the plan. Reuses agent_teams_reassign_task so attempts and scheduling
        // stay on the single host path.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/resume-last',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                const stateRoot = join(workspace, resolved.stateDir);
                const team = await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (team === undefined) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no active team for this session' }));
                    return;
                }
                const interrupted = [...team.tasks]
                    .filter(isInterruptedTask)
                    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0];
                if (interrupted === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'no interrupted task to resume' }));
                    return;
                }
                const assignee = interrupted.assignee === undefined || interrupted.assignee === '' ? 'captain' : interrupted.assignee;
                if ((interrupted.retryCount ?? 0) >= 3) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'auto resume limit reached; needs human triage', taskId: interrupted.id, retries: interrupted.retryCount ?? 0 }));
                    return;
                }
                const prior = await readResumeCheckpoint(stateRoot, team.id);
                if (prior !== undefined && prior.taskId === interrupted.id && Date.now() - prior.at < 120_000) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'resume already in progress', taskId: interrupted.id }));
                    return;
                }
                const definition = ctx.get('tools')?.get?.('agent_teams_reassign_task');
                if (definition?.execute === undefined) {
                    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'reassign tool is unavailable' }));
                    return;
                }
                const run = { agent: captain, signal: new AbortController().signal, deferContext() { }, concludeTurn() { } };
                let reserved = false;
                try {
                    await writeResumeCheckpoint(stateRoot, team.id, {
                        version: 1,
                        taskId: interrupted.id,
                        attempt: interrupted.attempt ?? 0,
                        retry: (interrupted.retryCount ?? 0) + 1,
                        at: Date.now(),
                    }).catch(() => undefined);
                    await withTeamLock(teamLockKey(stateRoot, team.id), async () => {
                        const fresh = await readTeam(stateRoot, team.id);
                        const task = fresh?.tasks.find(candidate => candidate.id === interrupted.id);
                        if (fresh === undefined || task === undefined)
                            throw new Error('task no longer exists');
                        const used = task.retryCount ?? 0;
                        if (used >= 3)
                            throw Object.assign(new Error('auto resume limit reached; needs human triage'), { code: 'NEEDS_HUMAN' });
                        task.retryCount = used + 1;
                        task.updatedAt = Date.now();
                        await writeTeam(stateRoot, fresh);
                        reserved = true;
                    });
                    const value = await definition.execute({ task_id: interrupted.id, assignee, reason: '恢复上次中断任务' }, run);
                    await clearResumeCheckpoint(stateRoot, team.id).catch(() => undefined);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, taskId: interrupted.id, assignee, retries: (interrupted.retryCount ?? 0) + 1, value }));
                }
                catch (error) {
                    await clearResumeCheckpoint(stateRoot, team.id).catch(() => undefined);
                    if (reserved) {
                        try {
                            await withTeamLock(teamLockKey(stateRoot, team.id), async () => {
                                const fresh = await readTeam(stateRoot, team.id);
                                const task = fresh?.tasks.find(candidate => candidate.id === interrupted.id);
                                if (fresh === undefined || task === undefined)
                                    return;
                                task.retryCount = Math.max(0, (task.retryCount ?? 1) - 1);
                                task.updatedAt = Date.now();
                                await writeTeam(stateRoot, fresh);
                            });
                        }
                        catch { /* best effort rollback */ }
                    }
                    const message = error instanceof Error ? error.message : String(error);
                    const status = error.code === 'NEEDS_HUMAN' ? 409 : 422;
                    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
            },
        }), 'agent-teams: resume last route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/resume',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const tools = ctx.get('tools');
                const definition = tools?.get?.('agent_teams_resume');
                if (definition?.execute === undefined) {
                    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team resume tool is unavailable' }));
                    return;
                }
                const reason = typeof payload.reason === 'string' && payload.reason.trim() !== ''
                    ? payload.reason.trim()
                    : 'Resumed from the Web panel';
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                const run = { agent: captain, signal: abort.signal, deferContext() { }, concludeTurn() { } };
                try {
                    const value = await definition.execute({ reason }, run);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, status: value.status, teamId: value.team_id }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn(`agent-teams: resume failed for ${sessionId}: ${message}`);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: resume route');
        // 重新：把失败任务重新派发（reassign），无需用户再发任何消息。
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/retry',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';
                if (sessionId === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId is required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const registry = ctx.get('tools');
                const statusTool = registry?.get?.('agent_teams_status');
                const reassignTool = registry?.get?.('agent_teams_reassign_task');
                if (statusTool?.execute === undefined || reassignTool?.execute === undefined) {
                    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team tools are unavailable' }));
                    return;
                }
                const run = { agent: captain, signal: new AbortController().signal, deferContext() { }, concludeTurn() { } };
                try {
                    const status = await statusTool.execute({}, run);
                    if (teamId !== '' && status.team_id !== undefined && status.team_id !== teamId) {
                        res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'team mismatch' }));
                        return;
                    }
                    const fallback = (status.members ?? []).map(member => member.name ?? '').find(name => name !== '') ?? '';
                    const failed = (status.tasks ?? []).filter(task => task.status === 'failed' && task.id !== undefined && task.id !== '');
                    const retried = [];
                    const errors = [];
                    for (const task of failed) {
                        const assignee = task.assignee !== undefined && task.assignee !== '' ? task.assignee : fallback;
                        if (assignee === '')
                            continue;
                        try {
                            await reassignTool.execute({ task_id: task.id, assignee, reason: '重新：Web 面板重派失败任务' }, run);
                            retried.push(task.id);
                        }
                        catch (error) {
                            errors.push((error instanceof Error ? error.message : String(error)).slice(0, 160));
                        }
                    }
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, retried, errors }));
                }
                catch (error) {
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            },
        }), 'agent-teams: retry route');
        // Click-to-dispatch: the Web "开团" dialog asks the host to stage exactly
        // what the captain tool would stage, so the user never has to type a
        // command. Approval stays required; this route never spawns members.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/quick-start',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                let sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                // Older/newer hosts can omit the visible session id. Reuse a live agent
                // instead of failing the founding request with HTTP 400.
                if (sessionId === '') {
                    try {
                        const live = ctx.agents.list();
                        sessionId = live.length === 1 ? live[0]?.id ?? '' : live[0]?.id ?? '';
                    }
                    catch { /* leave empty for the validation error */ }
                }
                const goal = typeof payload.goal === 'string' ? payload.goal.trim() : '';
                // 默认法脉 = 功能直交 (ship). An explicit template still wins.
                const template = typeof payload.template === 'string' && payload.template.trim() !== '' ? payload.template : DEFAULT_DOCTRINE;
                const roles = Array.isArray(payload.roles) ? payload.roles.filter((role) => typeof role === 'string') : undefined;
                const payloadDoctrine = isDoctrineId(payload.doctrine) ? payload.doctrine : undefined;
                const payloadAmbition = isAmbitionId(payload.ambition) ? payload.ambition : undefined;
                const referenceRecord = typeof payload.reference === 'object' && payload.reference !== null
                    ? payload.reference
                    : undefined;
                const referenceInput = (typeof payload.reference === 'string' ? payload.reference : typeof referenceRecord?.['input'] === 'string' ? referenceRecord['input'] : '').trim();
                const clearReference = payload.clearReference === true || payload.reference === null;
                const corrections = normalizeFoundingCorrections(payload.corrections);
                if (sessionId === '' || goal === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and goal are required' }));
                    return;
                }
                // Blocking clarification root: no DAG is generated before the user
                // confirms this form. The wizard's mode wins over a missing mode field.
                const minimal = payload.minimal === true;
                let clarification;
                if (minimal) {
                    const effectiveMode = isTeamMode(payload.mode) ? payload.mode : DEFAULT_MODE;
                    const spec = getModeSpec(effectiveMode);
                    clarification = normalizeClarification({
                        type: 'software',
                        scale: 'small',
                        mode: effectiveMode,
                        ...payloadDoctrine === undefined ? {} : { doctrine: payloadDoctrine },
                        ...payloadAmbition === undefined ? {} : { ambition: payloadAmbition },
                        ui: { styles: [] },
                        platforms: ['Windows'],
                        hardwareList: [],
                        constraints: [],
                        excluded: [...spec.defaultExcluded],
                        acceptance: [...spec.acceptanceDefaults],
                        memoryHints: [],
                    });
                }
                else {
                    try {
                        const rawClarification = typeof payload.clarification === 'object' && payload.clarification !== null
                            ? payload.clarification
                            : {};
                        const requestedMode = isTeamMode(payload.mode) ? payload.mode : undefined;
                        const rawMode = rawClarification['mode'];
                        const effectiveMode = requestedMode ?? (isTeamMode(rawMode) ? rawMode : DEFAULT_MODE);
                        clarification = normalizeClarification({
                            ...rawClarification,
                            mode: effectiveMode,
                            ...payloadDoctrine === undefined ? {} : { doctrine: payloadDoctrine },
                            ...payloadAmbition === undefined ? {} : { ambition: payloadAmbition },
                        });
                    }
                    catch (error) {
                        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: 'clarification is required before founding a team: ' + (error instanceof Error ? error.message : String(error)) }));
                        return;
                    }
                }
                // 阵营可由顶层 payload 或 clarification 携带；两者合法时顶层优先。
                const requestedFaction = isFactionId(payload.faction) ? payload.faction : clarification.faction;
                if (requestedFaction !== undefined) {
                    clarification = { ...clarification, faction: requestedFaction };
                }
                const faction = factionById(clarification.faction);
                const factionRoleNamesMap = faction === undefined ? {} : factionRoleNames(faction);
                const requestedRoleNames = (() => {
                    const raw = payload.roleNames;
                    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                        return {};
                    const out = {};
                    for (const [role, value] of Object.entries(raw)) {
                        if (typeof value !== 'string')
                            continue;
                        const key = role.trim();
                        const name = value.trim();
                        if (key === '' || name === '' || key.length > 40 || name.length > 40)
                            continue;
                        out[key] = name;
                    }
                    return out;
                })();
                const mergedRoleNames = { ...factionRoleNamesMap, ...requestedRoleNames };
                const roleNames = Object.keys(mergedRoleNames).length === 0 ? undefined : mergedRoleNames;
                const roleAgents = (() => {
                    const raw = payload.roleAgents;
                    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                        return {};
                    const out = {};
                    for (const [role, value] of Object.entries(raw)) {
                        if (typeof value !== 'string')
                            continue;
                        const key = role.trim();
                        const agent = value.trim();
                        if (key === '' || agent === '' || key.length > 40 || agent.length > 40)
                            continue;
                        out[key] = agent;
                    }
                    return out;
                })();
                const rolePrompts = (() => {
                    const raw = payload.rolePrompts;
                    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                        return {};
                    const out = {};
                    for (const [role, value] of Object.entries(raw)) {
                        if (typeof value !== 'string')
                            continue;
                        const key = role.trim();
                        const prompt = value.trim();
                        if (key === '' || prompt === '' || key.length > 40 || prompt.length > 40000)
                            continue;
                        out[key] = prompt;
                    }
                    return out;
                })();
                const roleExecutors = (() => {
                    const raw = payload.roleExecutors;
                    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                        return {};
                    const out = {};
                    for (const [role, value] of Object.entries(raw)) {
                        if (typeof value !== 'string')
                            continue;
                        const key = role.trim();
                        const executor = value.trim();
                        if (key === '' || executor === '' || key.length > 60 || executor.length > 40)
                            continue;
                        out[key] = executor;
                    }
                    return out;
                })();
                const factionTeamName = faction?.name;
                const requestedTeamName = typeof payload.teamName === 'string' ? payload.teamName.trim() : '';
                const requirementRaw = payload.requirement;
                const requirement = (() => {
                    if (typeof requirementRaw !== 'object' || requirementRaw === null)
                        return undefined;
                    const record = requirementRaw;
                    const original = typeof record['original'] === 'string' ? record['original'].trim() : '';
                    const expanded = typeof record['expanded'] === 'string' ? record['expanded'].trim() : '';
                    const conditions = Array.isArray(record['conditions'])
                        ? record['conditions'].filter((item) => typeof item === 'string')
                        : [];
                    const attachments = Array.isArray(record['attachments'])
                        ? record['attachments'].flatMap(item => {
                            if (typeof item !== 'object' || item === null)
                                return [];
                            const entry = item;
                            const path = typeof entry['path'] === 'string' ? entry['path'].trim() : '';
                            const mime = typeof entry['mime'] === 'string' ? entry['mime'] : '';
                            const kind = entry['kind'] === 'image' || entry['kind'] === 'video' ? entry['kind'] : undefined;
                            const name = typeof entry['name'] === 'string' ? entry['name'] : '';
                            const size = typeof entry['size'] === 'number' ? entry['size'] : 0;
                            if (path === '' || kind === undefined || name === '')
                                return [];
                            return [{ name, path, mime, kind: kind, size }];
                        }).slice(0, 20)
                        : [];
                    if (original === '' && expanded === '')
                        return undefined;
                    return { original: original === '' ? expanded : original, expanded, conditions, ...attachments.length === 0 ? {} : { attachments } };
                })();
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const tools = ctx.get('tools');
                const definition = tools?.get?.('agent_teams_create');
                const taskDefinition = tools?.get?.('agent_teams_create_task');
                if (definition?.execute === undefined || taskDefinition?.execute === undefined) {
                    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team creation tools are unavailable' }));
                    return;
                }
                const workspace = captain.session.header.cwd ?? process.cwd();
                // Attachments must stay inside the workspace's upload area; a payload
                // cannot point members at arbitrary host files.
                if (requirement !== undefined && requirement.attachments !== undefined) {
                    const safe = requirement.attachments.filter((item) => {
                        if (!item.path.startsWith('.pixel-team/uploads/'))
                            return false;
                        const rel = relative(workspace, resolve(workspace, item.path));
                        return rel !== '' && !rel.startsWith('..') && !item.path.includes('..');
                    });
                    if (safe.length > 0)
                        requirement.attachments = safe.slice(0, 20);
                    else
                        delete requirement.attachments;
                }
                // One active team per captain: reuse it instead of failing with
                // "you already lead team" and instead of deleting/recreating it.
                const existingRoot = join(workspace, config.stateDir ?? '.agent-teams');
                const existingTeam = await findTeamByCaptain(existingRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if (existingTeam !== undefined && existingTeam.phase === 'staged') {
                    const teamSnapshot = await assembleTeamSnapshot(ctx, existingRoot, workspace, existingTeam, {});
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, existing: true, teamId: existingTeam.id, teamName: existingTeam.name, phase: existingTeam.phase, team: teamSnapshot }));
                    return;
                }
                // 参考项目: analyze before planning so the DAG, the interview-shaped
                // constraints and the constitution all see the same profile. The bag's
                // cached profile is reused for the same input instead of re-fetching.
                let referenceProfile;
                let referenceWarning;
                if (referenceInput !== '') {
                    try {
                        const remembered = await readFoundingBag(workspace);
                        referenceProfile = remembered?.reference?.input === referenceInput && remembered.reference.profile !== undefined
                            ? remembered.reference.profile
                            : await analyzeReference(workspace, referenceInput, { timeoutMs: 15_000 });
                        clarification.reference = clarifyReferenceOf(referenceProfile);
                    }
                    catch (error) {
                        // A reference the host cannot read must not silently pretend it
                        // shaped the plan: record the marker, warn, and keep founding.
                        referenceWarning = error instanceof Error ? error.message : String(error);
                        const kind = classifyReference(referenceInput, workspace)?.kind ?? 'local';
                        clarification.reference = { input: referenceInput.slice(0, 500), kind };
                        ctx.logger.warn('agent-teams: reference analysis degraded: ' + referenceWarning);
                    }
                }
                // User corrections (high priority) layer over the reference profile;
                // they are what the interview showed after the user changed a default.
                const layered = referenceProfile === undefined
                    ? undefined
                    : layerReferenceDefaults(referenceProfile.inferred, corrections);
                const referenceDefaults = layered?.defaults ?? referenceProfile?.inferred;
                // Every founding project lives under projects/<slug>/; platform files are
                // off-limits unless the user explicitly asks to change the plugin.
                const projectRoot = projectRootFor(goal, config.boundary?.productsDir);
                // Module 5: executable acceptance lines become verifier commands; the
                // prose criteria stay on the verification/review tasks.
                const acceptance = splitAcceptance(clarification.acceptance);
                const delivery = quickStartDeliveryDefaults(workspace);
                if (faction !== undefined)
                    delivery.faction = faction.id;
                if (requestedTeamName !== '')
                    delivery.teamName = requestedTeamName;
                else if (faction !== undefined)
                    delivery.teamName = faction.name;
                if (roleNames !== undefined)
                    delivery.roleNames = roleNames;
                if (Object.keys(roleAgents).length > 0)
                    delivery.roleAgents = roleAgents;
                if (Object.keys(rolePrompts).length > 0)
                    delivery.rolePrompts = rolePrompts;
                if (Object.keys(roleExecutors).length > 0)
                    delivery.roleExecutors = roleExecutors;
                // Generated projects live under projects/<slug>/: the plugin's own
                // scripts (pnpm typecheck) do NOT verify the product. Prefer per-project
                // commands, then global commands, else a product-neutral check.
                const projectKey = projectRoot.replace(/^\.\//, '').replace(/\/+$/, '');
                const perProject = config.quality?.commandsByProject?.[projectKey];
                delivery.verify = perProject !== undefined && perProject.length > 0
                    ? [...perProject]
                    : config.quality?.commands !== undefined && config.quality.commands.length > 0
                        ? [...config.quality.commands]
                        : ['git diff --check'];
                delivery.verify = [...delivery.verify, ...acceptance.commands];
                delivery.mode = clarification.mode;
                // Constitution prose criteria land on the gates. The mode baseline is
                // appended only when the user explicitly picked precision/compliance;
                // draft (the default) must never inherit 72h/offline/leak defaults.
                delivery.acceptance = quickStartAcceptance(acceptance.criteria, clarification.mode);
                // Module 5: materialize the verifier as a script the host runs when the
                // verification task completes. Legacy prepends the discovered old
                // regression suite; compliance adds the dependency/secret audit.
                const scriptCommands = [...acceptance.commands];
                if (clarification.mode === 'legacy') {
                    const legacyCommand = detectLegacyRegressionCommand(workspace);
                    if (legacyCommand !== undefined)
                        scriptCommands.unshift(legacyCommand);
                }
                const verifierScript = buildVerifierScript(scriptCommands, 'verify-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), clarification.mode);
                if (verifierScript !== undefined) {
                    const scriptPath = join(workspace, verifierScript.relativePath);
                    await mkdir(dirname(scriptPath), { recursive: true });
                    await writeFile(scriptPath, verifierScript.content, 'utf8');
                    delivery.verify = [...delivery.verify, 'node ' + verifierScript.relativePath];
                }
                // Derive the DAG from the real goal + interview answers + mode; the
                // fixed template is only the fallback when generation is unusable.
                const planRoles = faction !== undefined && (roles?.length ?? 0) === 0
                    ? faction.members.map(member => member.role)
                    : quickStartRoles(template, roles);
                const forbiddenPaths = derivePlatformPaths(workspace, config.boundary?.forbidden);
                delivery.inScope = [projectRoot];
                let planFacts = await describeWorkspaceFacts(workspace);
                if (requirement?.attachments !== undefined && requirement.attachments.length > 0) {
                    planFacts += '\n用户附件：' + requirement.attachments.map(item => item.path + '（' + item.kind + '）').join('；');
                }
                const planAbort = new AbortController();
                const planTimeout = setTimeout(() => { planAbort.abort(); }, 60_000);
                let planResult = { error: 'plan generation did not run' };
                if (payload.fast !== true && !minimal) {
                    let watchdog;
                    try {
                        const generation = generatePlanSpecs(ctx, captain, {
                            goal,
                            mode: clarification.mode,
                            clarification,
                            roles: planRoles.map(role => ({ role, name: roleNames?.[role] ?? ROLE_NAMES[role] ?? role })),
                            workspaceFacts: planFacts,
                            projectRoot,
                            forbiddenPaths,
                            ...referenceProfile === undefined ? {} : { referenceDigest: referenceDigestText(referenceProfile) },
                        }, planAbort.signal).catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
                        const timeoutResult = new Promise(resolve => {
                            watchdog = setTimeout(() => {
                                planAbort.abort();
                                resolve({ error: 'plan generation timed out; falling back to the template' });
                            }, 65_000);
                        });
                        planResult = await Promise.race([generation, timeoutResult]);
                    }
                    finally {
                        if (watchdog !== undefined)
                            clearTimeout(watchdog);
                        clearTimeout(planTimeout);
                    }
                }
                else {
                    clearTimeout(planTimeout);
                    planResult = { error: 'fast mode: template plan' };
                }
                const planSpecs = planResult.specs;
                const planError = planResult.error;
                // Even the template fallback must carry the user's real choices.
                delivery.contextText = [
                    '目标：' + goal,
                    ...faction === undefined ? [] : ['阵营皮肤：' + faction.name + '（' + faction.motif + '）'],
                    '法脉：' + (clarification.doctrine ?? DEFAULT_DOCTRINE) + '；视觉爆炸：' + (clarification.ambition === 'visual' ? '开启' : '未开启'),
                    '模式：' + clarification.mode,
                    '平台：' + clarification.platforms.join(' / '),
                    '访谈约束：' + (clarification.constraints.length === 0 ? '无' : clarification.constraints.join('；')),
                    ...requirement?.attachments === undefined || requirement.attachments.length === 0 ? [] : ['用户附件：' + requirement.attachments.map(item => item.name + '（' + item.path + '）').join('；')],
                    '验收：' + clarification.acceptance.join('；'),
                    '禁止边界：' + (clarification.excluded.length === 0 ? '无' : clarification.excluded.join('；')),
                    ...referenceProfile === undefined ? [] : ['参考项目（低优先级默认，用户修正优先）：', referenceDigestText(referenceProfile)],
                    ...referenceDefaults === undefined ? [] : ['参考项目推断默认：平台=' + (referenceDefaults.platforms.join('/') || '未识别') + '；风格=' + (referenceDefaults.uiStyles.join('/') || '未识别')],
                    '产物根目录：' + projectRoot,
                ].join('\n');
                const basePlan = planSpecs !== undefined
                    ? buildPlanFromSpecs(goal, template, planRoles, planSpecs, delivery)
                    : confinePlanToProject(buildQuickStartPlan(goal, template, roles, delivery), projectRoot);
                assignRequirementCoverage(basePlan.tasks, clarification.constraints.length > 0 ? clarification.constraints : clarification.acceptance, goal);
                // Solo run: no members are created; every task is assigned to the captain.
                const plan = payload.solo === true ? soloPlan(basePlan) : basePlan;
                const replace = payload.replace === true || existingTeam?.phase === 'running';
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                const run = { agent: captain, signal: abort.signal, deferContext() { }, concludeTurn() { } };
                try {
                    if (replace) {
                        // Explicit user choice (red "结束旧取经队并开新宗" button): end the
                        // current sect, including live work, then found the new one. The
                        // delete tool interrupts members and archives the team; the client
                        // only sends replace=true after the user confirms this action.
                        const remove = tools?.get?.('agent_teams_delete');
                        try {
                            await remove?.execute?.({}, run);
                        }
                        catch {
                            // The current team may already be gone; creation decides the real outcome.
                        }
                    }
                    // The create tool's plan schema only carries ordinary task fields, so
                    // the helper stages the roster first and adds every task — with its
                    // quality contract — through create_task, exactly like the captain
                    // does in chat. A failure after creation rolls the team back.
                    const value = await stageQuickStartTeam(plan, goal, run, {
                        create: definition,
                        createTask: taskDefinition,
                        deleteTeam: tools?.get?.('agent_teams_delete'),
                    }, { clarification, ...requirement === undefined ? {} : { requirement } });
                    // Persist how the plan was produced and where it may write, so the
                    // review can show alignment and flag template fallbacks.
                    if (value.teamId !== undefined && value.teamId !== '') {
                        const stateRoot = join(workspace, config.stateDir ?? '.agent-teams');
                        try {
                            await withTeamLock(teamLockKey(stateRoot, value.teamId), async () => {
                                const fresh = await readTeam(stateRoot, value.teamId);
                                if (fresh === undefined)
                                    return;
                                fresh.planSource = planSpecs !== undefined ? 'ai' : 'template';
                                // The browser sends only the user's prompt overrides, so attach
                                // the host catalog body for every member that still has none.
                                const promptsForPlan = withRolePromptDefaults(fresh.members.filter(member => member.status !== 'removed').map(member => member.role ?? ''), delivery.rolePrompts ?? {});
                                if (Object.keys(promptsForPlan).length > 0)
                                    fresh.rolePrompts = promptsForPlan;
                                fresh.planProjectRoot = projectRoot;
                                if (planError !== undefined)
                                    fresh.planError = planError;
                                // Solo plans have no members; every task must belong to the captain.
                                if (payload.solo === true) {
                                    for (const task of fresh.tasks)
                                        task.assignee = 'captain';
                                }
                                await writeTeam(stateRoot, fresh);
                                // Persist the core architecture next to the product so later
                                // sessions/members can recover it instead of losing context.
                                syncArchitectureFile(workspace, fresh);
                            });
                        }
                        catch (error) {
                            ctx.logger.warn('agent-teams: plan metadata write failed: ' + String(error));
                        }
                    }
                    // 三界行囊: remember this founding so the next wizard opens with the
                    // same doctrine/ambition/reference instead of asking again.
                    try {
                        const rememberedReference = referenceProfile === undefined
                            ? referenceInput === '' ? undefined : {
                                input: referenceInput.slice(0, 500),
                                kind: clarification.reference?.kind ?? 'local',
                                ...clarification.reference?.label === undefined ? {} : { label: clarification.reference.label },
                                analyzedAt: Date.now(),
                            }
                            : {
                                input: referenceProfile.input,
                                kind: referenceProfile.kind,
                                label: referenceProfile.label,
                                analyzedAt: referenceProfile.analyzedAt,
                                profile: referenceProfile,
                            };
                        await rememberFounding(workspace, {
                            ...isDoctrineId(clarification.doctrine) ? { doctrine: clarification.doctrine } : {},
                            // null clears the remembered emphasis when the user founds with it off.
                            ambition: isAmbitionId(clarification.ambition) ? clarification.ambition : null,
                            mode: clarification.mode,
                            ...clearReference ? { reference: null } : rememberedReference === undefined ? {} : { reference: rememberedReference },
                            ...corrections === undefined ? {} : { corrections },
                        });
                    }
                    catch (error) {
                        ctx.logger.warn('agent-teams: founding bag write failed: ' + String(error));
                    }
                    let teamSnapshot;
                    if (value.teamId !== undefined && value.teamId !== '') {
                        const responseRoot = join(workspace, config.stateDir ?? '.agent-teams');
                        const fresh = await readTeam(responseRoot, value.teamId);
                        if (fresh !== undefined)
                            teamSnapshot = await assembleTeamSnapshot(ctx, responseRoot, workspace, fresh, {});
                    }
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        teamId: value.teamId,
                        teamName: value.teamName,
                        phase: value.phase,
                        template: plan.template,
                        tasks: plan.tasks.length,
                        doctrine: clarification.doctrine,
                        ambition: clarification.ambition,
                        ...referenceProfile === undefined ? {} : { reference: { input: referenceProfile.input, label: referenceProfile.label, degraded: referenceProfile.degraded } },
                        ...referenceDefaults === undefined ? {} : { referenceDefaults },
                        ...referenceWarning === undefined ? {} : { referenceWarning },
                        ...teamSnapshot === undefined ? {} : { team: teamSnapshot },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    // Never auto-delete an existing team here: the client asks the user to
                    // confirm replace, so a plain "found a new sect" cannot wipe the current
                    // run (and its conversation trail) by surprise.
                    ctx.logger.warn(`agent-teams: quick-start failed for ${sessionId}: ${message}`);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: quick-start route');
        // Module 0: optional requirement polish. One-shot model call; failures
        // degrade to the original text so the wizard never dead-ends.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/polish',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const requirement = typeof payload.requirement === 'string' ? payload.requirement.trim() : '';
                if (sessionId === '' || requirement === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and requirement are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const mode = isTeamMode(payload.mode) ? payload.mode : DEFAULT_MODE;
                const workspace = captain.session.header.cwd ?? process.cwd();
                const facts = await describeWorkspaceFacts(workspace);
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                try {
                    const result = await polishRequirement(ctx, captain, { requirement, workspaceFacts: facts, mode }, abort.signal);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        expanded: result.expanded,
                        hidden_conditions: [...result.hiddenConditions],
                        degraded: result.degraded,
                        ...result.error === undefined ? {} : { error: result.error },
                        ...result.model === undefined ? {} : { model: result.model },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: polish failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: polish route');
        // Module 1: AI-generated clarification options. The static lists are only
        // the degraded fallback; the normal path tailors every section to the request.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/clarify/options',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const raw = typeof payload.requirement === 'object' && payload.requirement !== null
                    ? payload.requirement
                    : undefined;
                const original = raw !== undefined && typeof raw['original'] === 'string' ? raw['original'].trim() : '';
                if (sessionId === '' || original === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and requirement.original are required' }));
                    return;
                }
                const requirement = {
                    original,
                    expanded: raw !== undefined && typeof raw['expanded'] === 'string' ? raw['expanded'].trim() : '',
                    conditions: raw !== undefined && Array.isArray(raw['conditions'])
                        ? raw['conditions'].filter((item) => typeof item === 'string')
                        : [],
                };
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const mode = isTeamMode(payload.mode) ? payload.mode : DEFAULT_MODE;
                const workspace = captain.session.header.cwd ?? process.cwd();
                const facts = await describeWorkspaceFacts(workspace);
                // Reference/ambition shape the option lists and are echoed back so the
                // form can mark which defaults came from the reference project.
                const reference = await resolveReferenceContext(workspace, payload);
                const ambition = typeof payload.ambition === 'string' ? payload.ambition : undefined;
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                try {
                    const options = await generateClarifyOptions(ctx, captain, {
                        requirement,
                        workspaceFacts: facts,
                        mode,
                        ...ambition === undefined ? {} : { ambition },
                        ...reference.digest === undefined ? {} : { referenceDigest: reference.digest },
                        ...reference.defaults === undefined ? {} : { referenceDefaults: reference.defaults },
                    }, abort.signal);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        options,
                        ...reference.defaults === undefined ? {} : { referenceDefaults: reference.defaults },
                        ...reference.profile === undefined ? {} : { reference: { input: reference.profile.input, label: reference.profile.label, degraded: reference.profile.degraded } },
                        ...reference.warning === undefined ? {} : { referenceWarning: reference.warning },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: clarify options failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: clarify options route');
        // Dynamic interview: the model asks its own template-like questions instead
        // of the fixed clarification form, then turns the answers into the object
        // the founding flow consumes.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/interview/questions',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const requirement = typeof payload.requirement === 'string' ? payload.requirement.trim() : '';
                if (sessionId === '' || requirement === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and requirement are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const mode = isTeamMode(payload.mode) ? payload.mode : DEFAULT_MODE;
                const workspace = captain.session.header.cwd ?? process.cwd();
                const facts = await describeWorkspaceFacts(workspace);
                // 参考项目必须参与访谈：its profile/digest/defaults ride into question
                // generation, and the defaults are returned for the "inferred" panel.
                const reference = await resolveReferenceContext(workspace, payload);
                const ambition = typeof payload.ambition === 'string' ? payload.ambition : undefined;
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                try {
                    const questions = await generateInterviewQuestions(ctx, captain, {
                        requirement,
                        mode,
                        workspaceFacts: facts,
                        ...ambition === undefined ? {} : { ambition },
                        ...reference.digest === undefined ? {} : { referenceDigest: reference.digest },
                        ...reference.defaults === undefined ? {} : { referenceDefaults: reference.defaults },
                    }, abort.signal);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        questions,
                        ...reference.defaults === undefined ? {} : { referenceDefaults: reference.defaults },
                        // Full analyzed profile: the interview panel needs stack/habits/defaults
                        // to render 已从参考项目推断出的默认选择 without a second round-trip.
                        ...reference.profile === undefined ? {} : { reference: reference.profile },
                        ...reference.warning === undefined ? {} : { referenceWarning: reference.warning },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: interview questions failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: interview questions route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/interview/answers',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const requirement = typeof payload.requirement === 'string' ? payload.requirement.trim() : '';
                if (sessionId === '' || requirement === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId and requirement are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const rawAnswers = Array.isArray(payload.answers) ? payload.answers : [];
                const answers = rawAnswers.flatMap(item => {
                    if (typeof item !== 'object' || item === null)
                        return [];
                    const record = item;
                    const question = typeof record.question === 'string' ? record.question : '';
                    const answer = Array.isArray(record.answer) ? record.answer.filter((value) => typeof value === 'string') : [];
                    if (question === '')
                        return [];
                    return [{ question, answer }];
                });
                const mode = isTeamMode(payload.mode) ? payload.mode : DEFAULT_MODE;
                const workspace = captain.session.header.cwd ?? process.cwd();
                const reference = await resolveReferenceContext(workspace, payload);
                const doctrine = typeof payload.doctrine === 'string' ? payload.doctrine : undefined;
                const ambition = typeof payload.ambition === 'string' ? payload.ambition : undefined;
                const abort = new AbortController();
                const timeout = setTimeout(() => { abort.abort(); }, 30_000);
                try {
                    const clarification = await generateClarificationFromAnswers(ctx, captain, {
                        requirement,
                        mode,
                        answers,
                        ...doctrine === undefined ? {} : { doctrine },
                        ...ambition === undefined ? {} : { ambition },
                        ...reference.profile === undefined ? {} : { reference: clarifyReferenceOf(reference.profile) },
                        ...reference.digest === undefined ? {} : { referenceDigest: reference.digest },
                    }, abort.signal);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        clarification,
                        ...reference.defaults === undefined ? {} : { referenceDefaults: reference.defaults },
                        ...reference.warning === undefined ? {} : { referenceWarning: reference.warning },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: interview answers failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
                finally {
                    clearTimeout(timeout);
                }
            },
        }), 'agent-teams: interview answers route');
        // 参考项目: analyze a URL / GitHub repo / local path and remember it.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/reference/analyze',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const reference = typeof payload.reference === 'string' ? payload.reference.trim() : '';
                if (reference === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'reference is required' }));
                    return;
                }
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                const workspace = captain?.session.header.cwd ?? process.cwd();
                try {
                    const profile = await analyzeReference(workspace, reference, { timeoutMs: 20_000 });
                    const corrections = normalizeFoundingCorrections(payload.corrections);
                    const layered = layerReferenceDefaults(profile.inferred, corrections);
                    if (payload.save !== false) {
                        try {
                            await rememberFounding(workspace, {
                                reference: { input: profile.input, kind: profile.kind, label: profile.label, analyzedAt: profile.analyzedAt, profile },
                                ...corrections === undefined ? {} : { corrections },
                            });
                        }
                        catch (error) {
                            ctx.logger.warn('agent-teams: reference remember failed: ' + String(error));
                        }
                    }
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, profile, defaults: layered.defaults, overridden: layered.overridden }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: reference analysis failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
            },
        }), 'agent-teams: reference analyze route');
        // 三界行囊: the remembered founding choices (doctrine/ambition/mode/reference)
        // and the user's corrections, so a new session opens pre-filled.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/founding/bag',
            handler: async (req, res) => {
                if (req.method !== 'GET' && req.method !== 'POST') {
                    res.writeHead(405, { allow: 'GET, POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload = {};
                if (req.method === 'POST') {
                    try {
                        payload = await readJsonRequest(req);
                    }
                    catch (error) {
                        res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                        return;
                    }
                }
                const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
                const sessionId = (typeof payload.sessionId === 'string' ? payload.sessionId : query.get('sessionId') ?? '').trim();
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                const workspace = captain?.session.header.cwd ?? process.cwd();
                try {
                    let bag = await readFoundingBag(workspace);
                    if (req.method === 'POST') {
                        const referenceRaw = payload.reference;
                        const referenceInput = (typeof referenceRaw === 'string' ? referenceRaw
                            : typeof referenceRaw === 'object' && referenceRaw !== null && typeof referenceRaw['input'] === 'string'
                                ? referenceRaw['input']
                                : '').trim();
                        let remembered;
                        if (referenceInput !== '') {
                            const cached = bag?.reference;
                            if (cached?.input === referenceInput && cached.profile !== undefined) {
                                remembered = cached;
                            }
                            else {
                                try {
                                    const profile = await analyzeReference(workspace, referenceInput, { timeoutMs: 8_000 });
                                    remembered = { input: profile.input, kind: profile.kind, label: profile.label, analyzedAt: profile.analyzedAt, profile };
                                }
                                catch (error) {
                                    // Remember the choice even when the analysis is temporarily
                                    // unavailable; the next analysis refreshes the profile.
                                    ctx.logger.warn('agent-teams: bag reference analysis failed: ' + String(error));
                                    remembered = { input: referenceInput.slice(0, 500), kind: classifyReference(referenceInput, workspace)?.kind ?? 'local' };
                                }
                            }
                        }
                        const corrections = normalizeFoundingCorrections(payload.corrections);
                        bag = await rememberFounding(workspace, {
                            ...isDoctrineId(payload.doctrine) ? { doctrine: payload.doctrine } : {},
                            ...isAmbitionId(payload.ambition) ? { ambition: payload.ambition } : {},
                            ...isTeamMode(payload.mode) ? { mode: payload.mode } : {},
                            ...payload.clearReference === true || referenceRaw === null ? { reference: null } : remembered === undefined ? {} : { reference: remembered },
                            ...payload.clearCorrections === true ? { corrections: null } : corrections === undefined ? {} : { corrections },
                        });
                    }
                    const layered = bag?.reference?.profile === undefined
                        ? undefined
                        : layerReferenceDefaults(bag.reference.profile.inferred, bag.corrections);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({
                        ok: true,
                        bag: bag ?? null,
                        ...layered === undefined ? {} : { referenceDefaults: layered.defaults, overridden: layered.overridden },
                    }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: founding bag route failed: ' + message);
                    res.writeHead(422, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
            },
        }), 'agent-teams: founding bag route');
        // Goal attachments: images/videos dropped into the founding input are
        // stored under the workspace so members can open them by path.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/upload',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req, 40_000_000);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
                const name = typeof payload.name === 'string' ? payload.name.trim() : '';
                const mime = typeof payload.mime === 'string' ? payload.mime.trim() : '';
                const data = typeof payload.data === 'string' ? payload.data : '';
                const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : undefined;
                if (sessionId === '' || name === '' || kind === undefined || data === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId, name, image/video mime and data are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'session is not attached' }));
                    return;
                }
                const buffer = Buffer.from(data, 'base64');
                if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
                    res.writeHead(413, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'attachment must be between 1 byte and 25 MB' }));
                    return;
                }
                const safeName = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || 'attachment';
                const workspace = captain.session.header.cwd ?? process.cwd();
                const relativePath = '.pixel-team/uploads/' + sessionId.replace(/[^A-Za-z0-9._-]/g, '') + '/' + Date.now().toString(36) + '-' + safeName;
                try {
                    const absolute = join(workspace, relativePath);
                    await mkdir(dirname(absolute), { recursive: true });
                    await writeFile(absolute, buffer);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, attachment: { name, path: relativePath, mime, kind, size: buffer.length } }));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    ctx.logger.warn('agent-teams: attachment upload failed: ' + message);
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: message }));
                }
            },
        }), 'agent-teams: upload route');
        // 多 Agent 生态: list execution agents (dsh is the fallback) and the
        // captain's route so the plan review can offer an explicit model sync.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/agents',
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
                const sessionId = (query.get('sessionId') ?? '').trim();
                const captain = sessionId === '' ? undefined : ctx.agents.get(sessionId);
                const configured = Object.keys(config.memberAgentProviders ?? {}).map(id => ({ id, label: id }));
                let captainRoute;
                if (captain !== undefined) {
                    try {
                        const selection = await resolveMemberLlmSelection(ctx, captain, {});
                        captainRoute = { provider: selection.provider, model: selection.model };
                    }
                    catch { /* the captain route is optional */ }
                }
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({
                    ok: true,
                    agents: [{ id: 'dsh', label: 'DSH' }, ...configured],
                    ...captainRoute === undefined ? {} : { captain: captainRoute },
                }));
            },
        }), 'agent-teams: agents route');
        // Whether the optional memory brain is reachable: the banner shows
        // 已连接大脑 only when a real probe succeeds, otherwise the install hint.
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/memory/status',
            handler: async (req, res) => {
                if (req.method !== 'GET') {
                    res.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                const connected = await probeMemory(config.memory?.endpoint);
                res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                res.end(JSON.stringify({ connected }));
            },
        }), 'agent-teams: memory status route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/plugins/dsh-super-agent/plan',
            handler: async (req, res) => {
                if (req.method !== 'POST') {
                    res.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' });
                    res.end();
                    return;
                }
                let payload;
                try {
                    payload = await readJsonRequest(req);
                }
                catch (error) {
                    res.writeHead(error instanceof RequestBodyError ? error.status : 400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request body' }));
                    return;
                }
                const sessionId = typeof payload['sessionId'] === 'string' ? payload['sessionId'].trim() : '';
                const teamId = typeof payload['teamId'] === 'string' ? payload['teamId'].trim() : '';
                const action = typeof payload['action'] === 'string' ? payload['action'] : '';
                if (sessionId === '' || teamId === '' || action === '') {
                    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'sessionId, teamId, and action are required' }));
                    return;
                }
                const captain = ctx.agents.get(sessionId);
                let workspace = captain?.session.header.cwd ?? process.cwd();
                let stateRoot = join(workspace, resolved.stateDir);
                let team = captain === undefined
                    ? undefined
                    : await findTeamByCaptain(stateRoot, captain.id, await leadIdentityOfAsync(ctx, captain.session));
                if ((team === undefined || team.id !== teamId) && action === 'discard' && captain === undefined) {
                    for (const candidateWorkspace of workspaceRegistry.list()) {
                        const candidateRoot = join(candidateWorkspace.path, resolved.stateDir);
                        const candidate = await readTeam(candidateRoot, teamId);
                        if (candidate?.phase === 'staged') {
                            workspace = candidateWorkspace.path;
                            stateRoot = candidateRoot;
                            team = candidate;
                            break;
                        }
                    }
                }
                if (captain === undefined && action !== 'discard') {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                // A staged plan can outlive its original captain session. Adopt it into
                // the live session in the same workspace so approval/editing works.
                if (captain !== undefined && (team === undefined || team.id !== teamId)) {
                    const candidate = await readTeam(stateRoot, teamId);
                    if (candidate?.phase === 'staged') {
                        candidate.captainSessionId = captain.id;
                        await writeTeam(stateRoot, candidate);
                        team = candidate;
                    }
                }
                if (team === undefined || team.id !== teamId) {
                    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'team not found for this captain' }));
                    return;
                }
                if (action === 'discard') {
                    if (captain === undefined) {
                        await archiveTeamDir(stateRoot, teamId);
                        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ ok: true, phase: 'archived', teamId }));
                        return;
                    }
                    const discarded = await agentTeamsRuntime.discardStagedTeam(captain, teamId);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, phase: 'archived', ...discarded }));
                    return;
                }
                if (captain === undefined) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: 'captain session is not attached' }));
                    return;
                }
                try {
                    if (action === 'approve') {
                        const approved = await agentTeamsRuntime.approveStagedTeam(captain, teamId);
                        // The browser receives the HTTP result, so the model needs its own
                        // control message. steer wakes an idle captain or joins its next
                        // step; the tool approve path already returns to the model itself.
                        try {
                            captain.steer(createUserMessage({
                                content: [{ type: 'text', text: stagedPlanApprovedContext(team.name) + (approved.members === 0 ? '\n\n' + soloExecutionContext(team.name) : '') }],
                                source: agentTeamsSource({ kind: 'agent-teams' }, observedSessionFormatVersion(captain)),
                            }));
                        }
                        catch (error) {
                            // Approval is already committed. Do not report a failed approval
                            // and invite a retry that could duplicate the user's action.
                            ctx.logger.warn(`agent-teams: approval notification failed for ${teamId}: ${String(error)}`);
                        }
                        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ ok: true, phase: 'running', ...approved }));
                        return;
                    }
                    if (action === 'continue') {
                        const continued = await agentTeamsRuntime.continueStagedPlanning(captain, teamId);
                        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                        res.end(JSON.stringify({ ok: true, phase: 'staged', review: 'awaiting_feedback', ...continued }));
                        return;
                    }
                    const dependencies = Array.isArray(payload['dependencies'])
                        ? payload['dependencies'].filter((item) => typeof item === 'string')
                        : [];
                    let mutation;
                    if (action === 'update_member') {
                        if (typeof payload['memberName'] !== 'string'
                            || typeof payload['provider'] !== 'string'
                            || typeof payload['model'] !== 'string')
                            throw new Error('memberName, provider, and model are required');
                        mutation = {
                            action,
                            memberName: payload['memberName'],
                            provider: payload['provider'],
                            model: payload['model'],
                            ...typeof payload['agent'] === 'string' || payload['agent'] === null ? { agent: payload['agent'] } : {},
                            ...typeof payload['role'] === 'string' || payload['role'] === null ? { role: payload['role'] } : {},
                            ...typeof payload['reasoningEffort'] === 'string' || payload['reasoningEffort'] === null
                                ? { reasoningEffort: payload['reasoningEffort'] }
                                : {},
                            ...typeof payload['executionPrompt'] === 'string' || payload['executionPrompt'] === null
                                ? { executionPrompt: payload['executionPrompt'] }
                                : {},
                            ...typeof payload['tool_policy'] === 'string' ? { toolPolicy: payload['tool_policy'] } : {},
                        };
                    }
                    else if (action === 'update_task') {
                        if (typeof payload['taskId'] !== 'string' || typeof payload['subject'] !== 'string') {
                            throw new Error('taskId and subject are required');
                        }
                        mutation = {
                            action,
                            taskId: payload['taskId'],
                            subject: payload['subject'],
                            dependencies,
                            ...typeof payload['description'] === 'string' || payload['description'] === null
                                ? { description: payload['description'] }
                                : {},
                            ...typeof payload['assignee'] === 'string' || payload['assignee'] === null
                                ? { assignee: payload['assignee'] }
                                : {},
                        };
                    }
                    else if (action === 'add_task') {
                        if (typeof payload['subject'] !== 'string')
                            throw new Error('subject is required');
                        mutation = {
                            action,
                            subject: payload['subject'],
                            dependencies,
                            ...typeof payload['description'] === 'string' || payload['description'] === null
                                ? { description: payload['description'] }
                                : {},
                            ...typeof payload['assignee'] === 'string' || payload['assignee'] === null
                                ? { assignee: payload['assignee'] }
                                : {},
                        };
                    }
                    else if (action === 'remove_task') {
                        if (typeof payload['taskId'] !== 'string')
                            throw new Error('taskId is required');
                        mutation = { action, taskId: payload['taskId'] };
                    }
                    else {
                        throw new Error(`unknown plan action "${action}"`);
                    }
                    const updated = await agentTeamsRuntime.updateStagedPlan(captain, teamId, mutation);
                    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, phase: updated.phase, members: updated.members.length, tasks: updated.tasks.length }));
                }
                catch (error) {
                    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'plan operation failed' }));
                }
            },
        }), 'agent-teams: plan route');
        // Cultivation artwork: serve the packaged 法门 portraits and state icons to
        // the activity panel. An explicit allowlist guards the route (no path
        // traversal); the images ship with the bundle (files: assets/).
        const artDir = fileURLToPath(new URL('../assets/agent-teams/', import.meta.url));
        const ART_ALLOWLIST = new Set([
            'avatar-captain.png', 'avatar-planner.png', 'avatar-implementer.png',
            'avatar-verifier.png', 'avatar-reviewer.png', 'avatar-architect.png',
            'avatar-healer.png', 'avatar-demon.png',
            'state-working.png', 'state-idle.png', 'state-unknown.png',
        ]);
        ctx.effect(() => webServer.register({
            kind: 'prefix',
            path: '/plugins/dsh-super-agent/assets',
            handler: async (req, res) => {
                let name;
                try {
                    name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname.split('/').pop() ?? '');
                }
                catch {
                    // Malformed percent-encoding: treat as an unknown asset, not a 400.
                    res.writeHead(404);
                    res.end();
                    return;
                }
                if (!ART_ALLOWLIST.has(name)) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                try {
                    const data = await readFile(join(artDir, name));
                    res.writeHead(200, {
                        'content-type': 'image/png',
                        'cache-control': 'public, max-age=86400',
                    });
                    res.end(data);
                }
                catch (error) {
                    ctx.logger.warn(`agent-teams: artwork read failed for ${name}: ${String(error)}`);
                    res.writeHead(404);
                    res.end();
                }
            },
        }), 'agent-teams: artwork route');
        // Community / sponsor QR images: same allowlist discipline as the artwork
        // route, but from assets/support with their real media types.
        const supportDir = fileURLToPath(new URL('../assets/support/', import.meta.url));
        const SUPPORT_ASSETS = new Map([
            ['group-qr.jpg', 'image/jpeg'],
            ['group-wechat.jpg', 'image/jpeg'],
            ['wechat-pay.jpg', 'image/jpeg'],
            ['wechat-reward.jpg', 'image/jpeg'],
        ]);
        ctx.effect(() => webServer.register({
            kind: 'prefix',
            path: '/plugins/dsh-super-agent/support',
            handler: async (req, res) => {
                let name;
                try {
                    name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname.split('/').pop() ?? '');
                }
                catch {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                const mediaType = SUPPORT_ASSETS.get(name);
                if (mediaType === undefined) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                try {
                    const data = await readFile(join(supportDir, name));
                    res.writeHead(200, { 'content-type': mediaType, 'cache-control': 'public, max-age=86400' });
                    res.end(data);
                }
                catch (error) {
                    ctx.logger.warn(`agent-teams: support asset read failed for ${name}: ${String(error)}`);
                    res.writeHead(404);
                    res.end();
                }
            },
        }), 'agent-teams: support assets');
    };
    registerWebSurface();
    ctx.on('internal/service', (name) => {
        if (WEB_SERVER_KEYS.includes(name)
            || WORKSPACE_KEYS.includes(name)) {
            registerWebSurface();
        }
    });
}
