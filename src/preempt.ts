/**
 * 「停止当前任务并执行新任务」的后续派发决策（t67）。
 *
 * 调度器只会把任务派给它的 assignee，因此「叫停后立刻开始」只有在
 * 下一个排队任务的 owner 空闲时才成立。这里把判定与「是否改派」抽成纯函数，
 * 供 /task/preempt 与离线自检共用；真正落盘仍由调用方在团队锁内完成。
 */
export interface PreemptMemberLike {
  readonly id: string
  readonly name: string
  readonly stopping?: boolean
}

export interface PreemptPlanInput {
  /** 下一个依赖已满足的排队任务；没有排队任务时为 undefined。 */
  readonly next: { readonly id: string; readonly assignee?: string } | undefined
  readonly members: readonly PreemptMemberLike[]
  /** 刚被中断的成员（若被停任务没有 assignee 则为 undefined）。 */
  readonly interrupted: PreemptMemberLike | undefined
  /** 与调度器 isMemberAvailable 同义：未挂载或已 idle 即可用。 */
  readonly isAvailable: (member: PreemptMemberLike) => boolean
}

export interface PreemptPlan {
  /** 是否敢承诺「立刻开始」。 */
  readonly started: boolean
  /** 需要改派时，目标成员名；否则 undefined。 */
  readonly reassignTo?: string
}

/** 纯函数：给定排队任务与成员可用性，决定是否改派、以及能否承诺立刻开始。 */
export function planPreemptHandover(input: PreemptPlanInput): PreemptPlan {
  const { next, members, interrupted, isAvailable } = input
  if (next === undefined) return { started: false }
  const owner = next.assignee === undefined ? undefined : members.find(member => member.name === next.assignee)
  const ownerAvailable = next.assignee === undefined ? false : isAvailable(owner ?? { id: '', name: next.assignee })
  // t67 修订：被中断的成员是「我们主动打断的」，它一定会走到 idle edge，
  // 因此不再要求「此刻已 idle」——interrupt 是异步的，读状态时它往往还是 working。
  // 只要 owner 不是它、且 owner 现在领不走任务，就把排队任务改派给它。
  if (interrupted !== undefined && next.assignee !== interrupted.name && !ownerAvailable) {
    return { started: true, reassignTo: interrupted.name }
  }
  // 不改派：owner 自己空闲（或任务本来就没指定 owner，任一空闲成员都能拿）才算立刻开始。
  if (next.assignee === undefined) return { started: interrupted !== undefined }
  return { started: ownerAvailable }
}
