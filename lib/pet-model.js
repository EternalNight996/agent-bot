const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
/** 离线最多结算 12 小时，避免久未打开后数值归零。 */
export const OFFLINE_CAP_MS = 12 * HOUR;
export const MAX_LEVEL = 50;
/** 一次睡觉持续 10 分钟；期间点击可提前唤醒。 */
export const SLEEP_MS = 10 * MINUTE;
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
/** 升到下一级需要的经验（当前等级）。 */
export function xpForNextLevel(level) {
    return 30 + Math.max(0, level - 1) * 20;
}
/** 由累计经验反推等级与当前级进度。 */
export function levelOf(xp) {
    let level = 1;
    let remaining = Math.max(0, Math.round(xp));
    while (level < MAX_LEVEL) {
        const need = xpForNextLevel(level);
        if (remaining < need)
            return { level, into: remaining, need };
        remaining -= need;
        level += 1;
    }
    return { level: MAX_LEVEL, into: 0, need: xpForNextLevel(MAX_LEVEL) };
}
export function stageOf(level) {
    if (level >= 8)
        return 'whale';
    if (level >= 5)
        return 'fat';
    if (level >= 3)
        return 'small';
    return 'fry';
}
export function newPet(now = Date.now()) {
    return {
        name: '小肥鱼',
        xp: 0,
        satiety: 70,
        mood: 80,
        energy: 90,
        lastTick: now,
        lastTaskCount: 0,
        lastFedAt: 0,
        lastPlayedAt: 0,
        lastPettedAt: 0,
        lastRestedAt: 0,
        sleeping: false,
        sleepStartedAt: 0,
        sleepUntil: 0,
    };
}
/**
 * 结算一段时间：饱食度下降、心情随饥饿加速下降、精力缓慢恢复。
 * 只按整分钟结算，离线时间截断到 12 小时。
 */
export function tickPet(pet, now = Date.now()) {
    const elapsed = Math.max(0, Math.min(OFFLINE_CAP_MS, now - pet.lastTick));
    const minutes = Math.floor(elapsed / MINUTE);
    if (minutes <= 0)
        return pet;
    if (pet.sleeping && pet.sleepUntil > 0) {
        const woke = now >= pet.sleepUntil;
        return {
            ...pet,
            satiety: clamp(pet.satiety - Math.floor(minutes / 20)),
            mood: woke ? clamp(pet.mood + 3) : pet.mood,
            energy: clamp(pet.energy + Math.floor(minutes / 2) + (woke ? 5 : 0)),
            sleeping: !woke,
            sleepStartedAt: woke ? 0 : pet.sleepStartedAt,
            sleepUntil: woke ? 0 : pet.sleepUntil,
            lastTick: pet.lastTick + minutes * MINUTE,
        };
    }
    const satiety = clamp(pet.satiety - Math.floor(minutes / 8));
    const moodDrop = satiety <= 0 ? Math.floor(minutes / 8) : Math.floor(minutes / 15);
    return {
        ...pet,
        satiety,
        mood: clamp(pet.mood - moodDrop),
        energy: clamp(pet.energy + Math.floor(minutes / 10)),
        lastTick: pet.lastTick + minutes * MINUTE,
    };
}
function cooled(pet, field, now, cooldownMs) {
    return now - pet[field] >= cooldownMs;
}
export function feedPet(pet, now = Date.now()) {
    if (pet.sleeping)
        return { pet, ok: false, reason: 'sleeping' };
    if (pet.satiety >= 100)
        return { pet, ok: false, reason: 'full' };
    if (!cooled(pet, 'lastFedAt', now, 15_000))
        return { pet, ok: false, reason: 'cooldown' };
    return {
        ok: true,
        pet: {
            ...pet,
            satiety: clamp(pet.satiety + 26),
            mood: clamp(pet.mood + 5),
            energy: clamp(pet.energy - 2),
            xp: pet.xp + 6,
            lastFedAt: now,
        },
    };
}
export function playPet(pet, now = Date.now()) {
    if (pet.sleeping)
        return { pet, ok: false, reason: 'sleeping' };
    if (pet.energy < 10)
        return { pet, ok: false, reason: 'tired' };
    if (!cooled(pet, 'lastPlayedAt', now, 20_000))
        return { pet, ok: false, reason: 'cooldown' };
    return {
        ok: true,
        pet: {
            ...pet,
            mood: clamp(pet.mood + 18),
            energy: clamp(pet.energy - 12),
            satiety: clamp(pet.satiety - 4),
            xp: pet.xp + 8,
            lastPlayedAt: now,
        },
    };
}
export function patPet(pet, now = Date.now()) {
    if (pet.sleeping) {
        return {
            ok: true,
            reason: 'woke',
            pet: { ...wakePet(pet), mood: clamp(pet.mood + 7), xp: pet.xp + 2, lastPettedAt: now },
        };
    }
    if (!cooled(pet, 'lastPettedAt', now, 8_000))
        return { pet, ok: false, reason: 'cooldown' };
    return {
        ok: true,
        pet: { ...pet, mood: clamp(pet.mood + 7), xp: pet.xp + 2, lastPettedAt: now },
    };
}
export function restPet(pet, now = Date.now()) {
    if (pet.sleeping)
        return { pet, ok: false, reason: 'sleeping' };
    if (pet.energy >= 100)
        return { pet, ok: false, reason: 'full' };
    if (!cooled(pet, 'lastRestedAt', now, 30_000))
        return { pet, ok: false, reason: 'cooldown' };
    return {
        ok: true,
        pet: {
            ...pet,
            sleeping: true,
            sleepStartedAt: now,
            sleepUntil: now + SLEEP_MS,
            mood: clamp(pet.mood + 2),
            xp: pet.xp + 3,
            lastRestedAt: now,
        },
    };
}
/** 点击唤醒；不在睡觉时返回原对象。 */
export function wakePet(pet) {
    if (!pet.sleeping)
        return pet;
    return { ...pet, sleeping: false, sleepStartedAt: 0, sleepUntil: 0, mood: clamp(pet.mood + 2) };
}
/** 每完成一个团队任务发一次经验，只对增量结算。 */
export function syncCompletedTasks(pet, completed) {
    const delta = Math.max(0, Math.floor(completed) - pet.lastTaskCount);
    if (delta <= 0)
        return pet;
    return {
        ...pet,
        xp: pet.xp + delta * 12,
        mood: clamp(pet.mood + delta * 4),
        lastTaskCount: Math.max(pet.lastTaskCount, Math.floor(completed)),
    };
}
/** 根据当前状态挑一句台词。 */
export function petSpeech(pet) {
    if (pet.sleeping)
        return 'sleeping';
    if (pet.satiety < 30)
        return 'hungry';
    if (pet.mood < 40)
        return 'bored';
    if (pet.energy < 25)
        return 'sleepy';
    return 'happy';
}
