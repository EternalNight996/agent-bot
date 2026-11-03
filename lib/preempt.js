/** 纯函数：给定排队任务与成员可用性，决定是否改派、以及能否承诺立刻开始。 */
export function planPreemptHandover(input) {
    const { next, members, interrupted, isAvailable } = input;
    if (next === undefined)
        return { started: false };
    const owner = next.assignee === undefined ? undefined : members.find(member => member.name === next.assignee);
    const ownerAvailable = next.assignee === undefined ? false : isAvailable(owner ?? { id: '', name: next.assignee });
    // t67 修订：被中断的成员是「我们主动打断的」，它一定会走到 idle edge，
    // 因此不再要求「此刻已 idle」——interrupt 是异步的，读状态时它往往还是 working。
    // 只要 owner 不是它、且 owner 现在领不走任务，就把排队任务改派给它。
    if (interrupted !== undefined && next.assignee !== interrupted.name && !ownerAvailable) {
        return { started: true, reassignTo: interrupted.name };
    }
    // 不改派：owner 自己空闲（或任务本来就没指定 owner，任一空闲成员都能拿）才算立刻开始。
    if (next.assignee === undefined)
        return { started: interrupted !== undefined };
    return { started: ownerAvailable };
}
