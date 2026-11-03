import type { AgentTeamsLocaleKey } from './locales.ts'

export type Translate = (key: AgentTeamsLocaleKey) => string

/** Modern software-team duties; these are prompt roles, not pixel characters. */
export const ROLE_IDS = [
  'planner', 'implementer', 'verifier', 'reviewer', 'analyst', 'operator', 'documenter',
  'architect', 'integrator', 'auditor', 'tester', 'security', 'frontend', 'backend',
  'writer', 'researcher', 'healer', 'talisman', 'beastmaster', 'puppeteer', 'musician',
  'poisoner', 'monk', 'demon', 'captain',
] as const

/** Localized duty name with the raw role id as fallback for custom roles. */
export function roleLabel(role: string, t: Translate): string {
  const key = ('role.label.' + role) as AgentTeamsLocaleKey
  const value = t(key)
  return value === key ? role : value
}

/** Localized default work description for a duty. */
export function roleDuty(role: string, t: Translate): string {
  const key = ('role.duty.' + role) as AgentTeamsLocaleKey
  const value = t(key)
  return value === key ? '' : value
}

const PERMISSION_EN: Readonly<Record<string, string>> = {
  '只读': 'read-only',
  '目标重定义': 'redefine goals',
  '写文件': 'write files',
  '执行命令': 'run commands',
  '多步工具链': 'multi-step tool chains',
  '发起建议': 'propose options',
  '生成候选': 'generate candidates',
  '只读写状态': 'read/write state only',
  '标记异常': 'flag anomalies',
  '跨阵营消息': 'cross-faction messages',
  '只编排': 'orchestrate only',
  '不调用生成工具': 'no generation tools',
  '修改任务契约': 'edit task contracts',
  '跨层沟通': 'cross-layer communication',
  '运行验证': 'run verification',
  '提交 findings': 'submit findings',
  '调度': 'dispatch',
  '建立 MCP 子任务': 'spawn MCP subtasks',
}

/** Translate the common permission tokens; unknown Chinese tokens stay verbatim. */
export function permissionLabel(permission: string, zh: boolean): string {
  return zh ? permission : PERMISSION_EN[permission] ?? permission
}

export interface RolePromptInput {
  readonly name: string
  readonly role: string
  readonly autonomy: string
  readonly budget: string
  readonly permissions: readonly string[]
  readonly constraint: string
}

/** A short, human-readable preview of the persona shown in the role settings page. */
export function rolePrompt(input: RolePromptInput, t: Translate, zh: boolean): string {
  const label = roleLabel(input.role, t)
  const duty = roleDuty(input.role, t)
  if (!zh) {
    return [
      'You are ' + input.name + ', duty: ' + label + '.',
      ...(duty === '' ? [] : ['Work: ' + duty]),
      'Autonomy: ' + input.autonomy + '; budget: ' + input.budget + '.',
      ...(input.permissions.length === 0 ? [] : ['Permissions: ' + input.permissions.join(', ') + '.']),
      ...(input.constraint === '' ? [] : ['Boundaries: ' + input.constraint + '.']),
      t('office.rolePromptCommon'),
    ].join('\n')
  }
  return [
    '你是 ' + input.name + '，职责是「' + label + '」。',
    ...(duty === '' ? [] : ['工作内容：' + duty]),
    '自主度：' + input.autonomy + '；预算：' + input.budget + '。',
    ...(input.permissions.length === 0 ? [] : ['权限：' + input.permissions.join('、') + '。']),
    ...(input.constraint === '' ? [] : ['边界：' + input.constraint + '。']),
    t('office.rolePromptCommon'),
  ].join('\n')
}
