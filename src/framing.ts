/**
 * 隐式任务定型 (implicit task framing).
 *
 * Before a direct-delivery (功能直交) founding starts, the orchestration side
 * records how it read the request: goal class, doctrine, ambition, reference
 * usage and whether the delivery is direct or gated. The result is invisible in
 * the founding UI but persisted twice for audit:
 *
 *   team.json`.framing`                    — durable, read by the captain tools
 *   `.pixel-team/<team>-framing.json`      — plain file a human can diff
 *
 * The classifier is deterministic on purpose: a model must not be able to
 * silently reclassify a fix as a feature between two runs.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TaskFraming, TeamClarification } from './types.ts'
import { DEFAULT_DOCTRINE, doctrineName, getDoctrineSpec, isDoctrineId } from './doctrine.ts'
import { isAmbitionId } from './ambition.ts'

export const FRAMING_DIR = '.pixel-team'

type GoalKind = TaskFraming['goalKind']

const GOAL_SIGNALS: ReadonlyArray<{ kind: GoalKind; pattern: RegExp; label: string }> = [
  { kind: 'fix', pattern: /修复|修 bug|bug|报错|异常|崩溃|失败|500|404|regression|hotfix/i, label: '修复/缺陷' },
  { kind: 'ui', pattern: /界面|视觉|页面|动效|动画|主题|品牌|构图|布局|UI\b|UX\b/i, label: '视觉/界面' },
  { kind: 'research', pattern: /调研|研究|对比|选型|资料|方案|竞品|research/i, label: '调研' },
  { kind: 'audit', pattern: /审计|巡查|安全检查|渗透|漏洞|audit/i, label: '审计' },
  { kind: 'build', pattern: /构建|发布|打包|上线|部署|release|deploy|publish/i, label: '构建发布' },
  { kind: 'docs', pattern: /文档|README|说明书|教程|手册|docs?\b/i, label: '文档' },
]

/** Deterministic goal classification used by the framing audit. */
export function classifyGoal(goal: string): { goalKind: GoalKind; signals: string[] } {
  for (const entry of GOAL_SIGNALS) {
    const matches = goal.match(entry.pattern)
    if (matches !== null && matches.length > 0) {
      return { goalKind: entry.kind, signals: [...new Set(matches.map(match => match.trim()))].slice(0, 4) }
    }
  }
  return { goalKind: 'feature', signals: [] }
}

/** Frame one founding request. Pure and deterministic. */
export function frameFounding(input: {
  goal: string
  clarification: TeamClarification
  /** Explicit doctrine; falls back to the clarification field then 功能直交. */
  doctrine?: string
  at?: number
}): TaskFraming {
  const goal = input.goal.trim()
  const doctrine = isDoctrineId(input.doctrine)
    ? input.doctrine
    : isDoctrineId(input.clarification.doctrine) ? input.clarification.doctrine : DEFAULT_DOCTRINE
  const ambition = isAmbitionId(input.clarification.ambition) ? input.clarification.ambition : undefined
  const { goalKind, signals } = classifyGoal(goal)
  const delivery: TaskFraming['delivery'] = doctrine === 'ship' ? 'direct' : 'gated'
  const reference = input.clarification.reference
  const noteParts = [
    '法脉=' + doctrineName(doctrine) + '（' + doctrine + '）',
    '宏愿=' + (ambition ?? '未启用'),
    '目标类型=' + goalKind,
    '交付=' + (delivery === 'direct' ? '功能直交' : '走模板/质量门禁'),
    ...signals.length === 0 ? [] : ['信号=' + signals.join('/')],
    ...reference === undefined ? [] : ['参考项目=' + (reference.label ?? reference.input)],
    '该定型由编排角色隐式完成，仅用于内部审计。',
  ]
  return {
    version: 1,
    at: input.at ?? Date.now(),
    doctrine,
    doctrineName: getDoctrineSpec(doctrine).name,
    ...ambition === undefined ? {} : { ambition },
    goalKind,
    signals,
    delivery,
    ...reference === undefined ? {} : { reference: { input: reference.input, kind: reference.kind, ...reference.label === undefined ? {} : { label: reference.label } } },
    note: noteParts.join('；'),
  }
}

function safeProjectKey(project: string): string {
  // Keep CJK sect names readable while removing separators that could escape
  // the audit directory; the result stays a single filename segment.
  return project.replace(/[^\p{L}\p{N}._-]/gu, '-').slice(0, 80) || 'team'
}

/** Workspace-relative audit path for one team. */
export function framingRelativePath(project: string): string {
  return FRAMING_DIR + '/' + safeProjectKey(project) + '-framing.json'
}

/** Write the human-auditable framing record next to the constitution. */
export async function writeFramingAudit(workspace: string, project: string, framing: TaskFraming): Promise<string> {
  const relative = framingRelativePath(project)
  await mkdir(join(workspace, FRAMING_DIR), { recursive: true })
  await writeFile(join(workspace, relative), JSON.stringify(framing, null, 2) + '\n', 'utf8')
  return relative
}
