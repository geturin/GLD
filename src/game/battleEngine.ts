import {
  collectDamageCut,
  collectDamageReduction,
  deterministicRoll,
  enemyModeAfterDamage,
  normalHitCount,
  resolveHit,
} from "./formulas";
import { t } from "../i18n/zhCN";
import type {
  BattleLogEntry,
  BattleState,
  Combatant,
  Enemy,
  SkillDefinition,
  StatusEffect,
} from "./types";

const NORMAL_ATTACK_CAP = 440_000;
const CHAIN_BURST_CAP = 1_680_000;

function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function makeLog(
  state: BattleState,
  actor: string,
  action: string,
  detail: string,
  damage?: number,
  feedback?: Partial<BattleLogEntry>,
): BattleLogEntry {
  return {
    id: `${state.turn}-${state.log.length}-${actor}-${action}`,
    turn: state.turn,
    actor,
    action,
    detail,
    damage,
    ...feedback,
  };
}

function splitDamage(damage: number, count: number) {
  if (count <= 1) {
    return [Math.round(damage)];
  }

  const base = Math.floor(damage / count);
  const remainder = Math.round(damage - base * count);
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function hitDamagesFromBreakdown(breakdown: { hitCount: number; instances: { damage: number }[] }) {
  return breakdown.instances.flatMap((instance) => splitDamage(instance.damage, breakdown.hitCount));
}

function tickStatus(effect: StatusEffect) {
  return { ...effect, duration: effect.duration - 1 };
}

function statusStackingKey(effect: StatusEffect) {
  return `${effect.stackingSide ?? "unframed"}:${effect.stackingKey ?? effect.label}`;
}

function statusPower(effect: StatusEffect) {
  return (
    (effect.attackDown ?? 0) +
    (effect.defenseDown ?? 0) +
    (effect.defenseUp ?? 0) +
    (effect.damageCut ?? 0) +
    (effect.damageReduction ?? 0) +
    (effect.damageTakenAmplified ?? 0) +
    (effect.specialAttackDamageDown ?? 0) +
    (effect.accuracyDown ?? 0) +
    (effect.dodgeRate ?? 0) +
    (effect.shield ?? 0) / 10000 +
    (effect.turnDamage ?? 0) / 10000 +
    (effect.modifiers?.reduce((sum, modifier) => sum + modifier.value, 0) ?? 0) +
    (effect.capUp?.reduce((sum, cap) => sum + cap.value, 0) ?? 0) +
    (effect.supplemental?.reduce((sum, rule) => sum + rule.amount / 100000, 0) ?? 0)
  );
}

function mergeStatusEffects(currentEffects: StatusEffect[], incomingEffects: StatusEffect[]) {
  return incomingEffects.reduce((effects, incoming) => {
    const next = structuredClone(incoming);
    const existingIndex = effects.findIndex((effect) => {
      if (next.stackingRule === "unique") {
        return statusStackingKey(effect) === statusStackingKey(next);
      }

      return (
        effect.stackingSide &&
        next.stackingSide &&
        statusStackingKey(effect) === statusStackingKey(next)
      );
    });

    if (next.stackingRule === "stack") {
      const existing = existingIndex >= 0 ? effects[existingIndex] : undefined;
      const stack = Math.min((existing?.stack ?? 0) + (next.stack ?? 1), next.maxStacks ?? 999);
      const stacked = {
        ...next,
        stack,
        duration: Math.max(existing?.duration ?? 0, next.duration),
      };

      return existingIndex >= 0
        ? effects.map((effect, index) => (index === existingIndex ? stacked : effect))
        : [...effects, stacked];
    }

    if (existingIndex < 0) {
      return [...effects, next];
    }

    const existing = effects[existingIndex];
    const existingPower = statusPower(existing);
    const nextPower = statusPower(next);

    return nextPower >= existingPower
      ? effects.map((effect, index) => (index === existingIndex ? next : effect))
      : effects;
  }, currentEffects);
}

function nextCooldown(skill: SkillDefinition) {
  return {
    ...skill,
    remainingCooldown: Math.max(0, skill.remainingCooldown - 1),
  };
}

function spendSkill(skill: SkillDefinition) {
  return {
    ...skill,
    remainingCooldown: skill.cooldown,
  };
}

function damageEnemy(enemy: Enemy, damage: number) {
  const hp = Math.max(0, enemy.hp - damage);
  const mode = enemyModeAfterDamage({ ...enemy, hp }, damage);
  return {
    ...enemy,
    hp,
    mode,
    modeGauge: Math.max(0, enemy.modeGauge - damage / enemy.maxHp),
  };
}

function effectiveMaxHp(member: Combatant, state: BattleState) {
  const maxHpLowered = member.statusEffects.reduce((total, effect) => total + (effect.maxHpLowered ?? 0), 0);
  return Math.max(1, Math.round((member.maxHp + state.weaponGrid.hp) * Math.max(0.01, 1 - maxHpLowered)));
}

function updateMember(state: BattleState, memberId: string, updater: (member: Combatant) => Combatant) {
  return {
    ...state,
    party: state.party.map((member) => (member.id === memberId ? updater(member) : member)),
  };
}

function consumeFirstStatus(member: Combatant, predicate: (effect: StatusEffect) => boolean) {
  let consumed = false;
  return {
    ...member,
    statusEffects: member.statusEffects.filter((effect) => {
      if (!consumed && predicate(effect)) {
        consumed = true;
        return false;
      }
      return true;
    }),
  };
}

function shieldDamage(member: Combatant, damage: number) {
  let remainingDamage = damage;
  const statusEffects = member.statusEffects
    .map((effect) => {
      if (!effect.shield || remainingDamage <= 0) {
        return effect;
      }

      const nextShield = Math.max(0, effect.shield - remainingDamage);
      remainingDamage = Math.max(0, remainingDamage - effect.shield);
      return { ...effect, shield: nextShield };
    })
    .filter((effect) => (effect.shield ?? 1) > 0);

  return {
    member: { ...member, statusEffects },
    damage: remainingDamage,
  };
}

function memberDodges(member: Combatant, seed: number) {
  const dodgeRate = Math.min(1, member.statusEffects.reduce((total, effect) => total + (effect.dodgeRate ?? 0), 0));
  return dodgeRate > 0 && deterministicRoll(seed, `${member.id}-dodge`) < dodgeRate;
}

function armoredReduction(member: Combatant, seed: number) {
  return member.statusEffects.reduce((reduction, effect) => {
    if (!effect.armored) {
      return reduction;
    }

    return deterministicRoll(seed, `${effect.id}-armored`) < effect.armored.chance
      ? Math.max(reduction, effect.armored.reduction)
      : reduction;
  }, 0);
}

function applyDamageToMember(state: BattleState, targetId: string, rawDamage: number, seed: number) {
  const target = state.party.find((member) => member.id === targetId);
  if (!target) {
    return { state, damage: 0 };
  }

  if (memberDodges(target, seed)) {
    return { state, damage: 0 };
  }

  let nextTarget = target;
  if (nextTarget.statusEffects.some((effect) => effect.unchallenged)) {
    nextTarget = consumeFirstStatus(nextTarget, (effect) => Boolean(effect.unchallenged));
    return { state: updateMember(state, targetId, () => nextTarget), damage: 0 };
  }

  if (nextTarget.statusEffects.some((effect) => effect.mirrorImage)) {
    nextTarget = consumeFirstStatus(nextTarget, (effect) => Boolean(effect.mirrorImage));
    return { state: updateMember(state, targetId, () => nextTarget), damage: 0 };
  }

  const reducedDamage = Math.round(rawDamage * (1 - armoredReduction(nextTarget, seed)));
  const shielded = shieldDamage(nextTarget, reducedDamage);
  nextTarget = shielded.member;
  let damage = shielded.damage;

  const maxHp = effectiveMaxHp(nextTarget, state);
  const chargeBarGainUp = nextTarget.statusEffects.reduce((total, effect) => total + (effect.chargeBarGainUp ?? 0), 0);
  const nextHp = Math.max(0, nextTarget.hp - damage);
  const gutsTriggered = nextHp <= 0 && nextTarget.statusEffects.some((effect) => effect.guts);
  nextTarget = {
    ...nextTarget,
    hp: gutsTriggered ? 1 : nextHp,
    chargeBar: Math.min(
      100,
      nextTarget.chargeBar + Math.max(3, Math.round((damage / maxHp) * 30 * (1 + chargeBarGainUp))),
    ),
    statusEffects: gutsTriggered
      ? consumeFirstStatus(nextTarget, (effect) => Boolean(effect.guts)).statusEffects
      : nextTarget.statusEffects,
    counterStacks: nextTarget.counterStacks ? nextTarget.counterStacks + 1 : nextTarget.counterStacks,
  };

  if (gutsTriggered) {
    damage = Math.max(0, target.hp - 1);
  }

  return {
    state: updateMember(state, targetId, () => nextTarget),
    damage,
  };
}

function healMember(state: BattleState, memberId: string, amount: number) {
  if (amount <= 0) {
    return state;
  }

  return updateMember(state, memberId, (member) => ({
    ...member,
    hp: Math.min(effectiveMaxHp(member, state), member.hp + amount),
  }));
}

function applyDrain(state: BattleState, memberId: string, damage: number) {
  const member = state.party.find((candidate) => candidate.id === memberId);
  if (!member || damage <= 0) {
    return state;
  }

  const drain = member.statusEffects.reduce(
    (total, effect) => ({
      ratio: total.ratio + (effect.drain?.ratio ?? 0),
      cap: total.cap + (effect.drain?.cap ?? 0),
    }),
    { ratio: 0, cap: 0 },
  );
  const heal = Math.min(Math.round(damage * drain.ratio), drain.cap);
  return healMember(state, memberId, heal);
}

function chargeGainMultiplier(member: Combatant) {
  return 1 + member.statusEffects.reduce((total, effect) => total + (effect.chargeBarGainUp ?? 0), 0);
}

function cannotAct(statusEffects: StatusEffect[], seed: number) {
  return statusEffects.some(
    (effect) =>
      effect.cannotAct ||
      (effect.cannotActChance !== undefined && deterministicRoll(seed, `${effect.id}-cannot-act`) < effect.cannotActChance),
  );
}

function attackMisses(statusEffects: StatusEffect[], seed: number) {
  const accuracyDown = Math.min(1, statusEffects.reduce((total, effect) => total + (effect.accuracyDown ?? 0), 0));
  return accuracyDown > 0 && deterministicRoll(seed, "accuracy-down") < accuracyDown;
}

function chargeDiamondsFrozen(statusEffects: StatusEffect[]) {
  return statusEffects.some((effect) => effect.chargeDiamondsFrozen);
}

function effectiveMaxChargeDiamonds(enemy: Enemy) {
  const extraDiamonds = enemy.statusEffects.reduce((total, effect) => total + (effect.chargeDiamondsMaxUp ?? 0), 0);
  return Math.max(1, enemy.maxChargeDiamonds + extraDiamonds);
}

function specialAttackDamageDown(statusEffects: StatusEffect[]) {
  return Math.min(1, statusEffects.reduce((total, effect) => total + (effect.specialAttackDamageDown ?? 0), 0));
}

function applyPartyStatus(party: Combatant[], effects: StatusEffect[]) {
  if (effects.length === 0) {
    return party;
  }

  return party.map((member) => ({
    ...member,
    statusEffects: mergeStatusEffects(member.statusEffects, effects),
  }));
}

function applySelfStatus(party: Combatant[], actorId: string, effects: StatusEffect[]) {
  if (effects.length === 0) {
    return party;
  }

  return party.map((member) =>
    member.id === actorId
      ? { ...member, statusEffects: mergeStatusEffects(member.statusEffects, effects) }
      : member,
  );
}

function debuffLands(state: BattleState, effect: StatusEffect, seed: number) {
  if (state.enemy.statusEffects.some((status) => status.immune || status.veil)) {
    return false;
  }

  const resistanceDown = state.enemy.statusEffects.reduce(
    (total, status) => total + (status.debuffResistanceDown ?? 0),
    0,
  );
  const accuracy = effect.accuracy ?? 1;
  const resistance = Math.max(0, state.enemy.debuffResistance - resistanceDown);
  return deterministicRoll(seed, effect.id) <= Math.max(0, accuracy - resistance);
}

function resolveEnemySpecial(state: BattleState, multiplier = 1) {
  if (
    state.enemy.chargeDiamonds < effectiveMaxChargeDiamonds(state.enemy) ||
    state.enemy.hp <= 0 ||
    chargeDiamondsFrozen(state.enemy.statusEffects)
  ) {
    return state;
  }

  const target =
    state.party.find((member) => member.substituteForTeam && member.hp > 0) ??
    state.party.find((member) => member.hp > 0);

  if (!target) {
    return state;
  }

  const attackDown = state.enemy.statusEffects.reduce(
    (total, effect) => total + (effect.attackDown ?? 0),
    0,
  );
  const effectiveAttack = state.enemy.attack * Math.max(0.1, 1 - attackDown);
  const damageCut = collectDamageCut(target.statusEffects);
  const damageReduction = collectDamageReduction(target.statusEffects);
  const misses = attackMisses(state.enemy.statusEffects, state.turn * 223);
  const rawDamage = misses
    ? 0
    : Math.round(
        effectiveAttack *
          (state.enemy.mode === "overdrive" ? 1.7 : 1.25) *
          multiplier *
          (1 - specialAttackDamageDown(state.enemy.statusEffects)) *
          (1 - damageCut) *
          (1 - damageReduction),
      );
  const damaged = applyDamageToMember(state, target.id, rawDamage, state.turn * 211);

  return {
    ...damaged.state,
    enemy: { ...state.enemy, chargeDiamonds: 0 },
    log: [
      ...damaged.state.log,
      makeLog(
        state,
        state.enemy.name,
        state.enemy.mode === "overdrive" ? t.battle.overdriveTrigger : t.battle.specialAttack,
        format(t.battle.takesDamage, {
          damage: rawDamage.toLocaleString(),
          target: target.name,
        }),
        damaged.damage,
        {
          feedback: "damage",
          targetId: target.id,
          targetType: "party",
          sourceId: state.enemy.id,
          sourceType: "enemy",
          sourceMotion: "attack",
          hitDamages: [damaged.damage],
        },
      ),
    ],
  };
}

function resolveEnemyNormalAttack(state: BattleState) {
  if (state.enemy.hp <= 0) {
    return state;
  }

  if (cannotAct(state.enemy.statusEffects, state.turn * 307)) {
    return {
      ...state,
      log: [
        ...state.log,
        makeLog(state, state.enemy.name, t.battle.attackNames.single, t.battle.enemyCannotAct),
      ],
    };
  }

  const target =
    state.party.find((member) => member.substituteForTeam && member.hp > 0) ??
    state.party.find((member) => member.hp > 0);

  if (!target) {
    return state;
  }

  const attackDown = state.enemy.statusEffects.reduce(
    (total, effect) => total + (effect.attackDown ?? 0),
    0,
  );
  const effectiveAttack = state.enemy.attack * Math.max(0.1, 1 - attackDown);
  const damageCut = collectDamageCut(target.statusEffects);
  const damageReduction = collectDamageReduction(target.statusEffects);
  const misses = attackMisses(state.enemy.statusEffects, state.turn * 331);
  const rawDamage = misses
    ? 0
    : Math.round(
        effectiveAttack *
          (state.enemy.mode === "overdrive" ? 1.1 : 1) *
          (1 - damageCut) *
          (1 - damageReduction),
      );
  const damaged = applyDamageToMember(state, target.id, rawDamage, state.turn * 313);
  const nextChargeDiamonds = chargeDiamondsFrozen(state.enemy.statusEffects)
    ? state.enemy.chargeDiamonds
    : Math.min(
        effectiveMaxChargeDiamonds(state.enemy),
        state.enemy.chargeDiamonds + (state.enemy.mode === "break" ? 0 : 1),
      );

  return {
    ...damaged.state,
    enemy: {
      ...state.enemy,
      chargeDiamonds: nextChargeDiamonds,
    },
    log: [
      ...damaged.state.log,
      makeLog(
        state,
        state.enemy.name,
        t.battle.attackNames.single,
        format(t.battle.takesDamage, {
          damage: rawDamage.toLocaleString(),
          target: target.name,
        }),
        damaged.damage,
        {
          feedback: "damage",
          targetId: target.id,
          targetType: "party",
          sourceId: state.enemy.id,
          sourceType: "enemy",
          sourceMotion: "attack",
          hitDamages: [damaged.damage],
        },
      ),
    ],
  };
}

function resolveEnemyAction(state: BattleState) {
  if (state.enemy.hp <= 0) {
    return state;
  }

  return state.enemy.chargeDiamonds >= effectiveMaxChargeDiamonds(state.enemy)
    ? resolveEnemySpecial(state)
    : resolveEnemyNormalAttack(state);
}

function turnHealing(member: Combatant, maxHp: number) {
  return member.statusEffects.reduce((total, effect) => {
    const refresh = effect.refresh ? Math.min(effect.refresh.amount, effect.refresh.cap ?? effect.refresh.amount) : 0;
    const revitalize =
      effect.revitalize && member.hp < maxHp
        ? Math.min(effect.revitalize.heal, effect.revitalize.cap ?? effect.revitalize.heal)
        : 0;
    return total + refresh + revitalize;
  }, 0);
}

function turnChargeBar(member: Combatant, maxHp: number) {
  return member.statusEffects.reduce((total, effect) => {
    const revitalizeCharge = effect.revitalize && member.hp >= maxHp ? effect.revitalize.chargeBar : 0;
    return total + (effect.uplift ?? 0) + revitalizeCharge;
  }, 0);
}

function turnDamage(statusEffects: StatusEffect[]) {
  return statusEffects.reduce((total, effect) => total + (effect.turnDamage ?? 0), 0);
}

function hasDeathGrace(member: Combatant) {
  return member.statusEffects.some((effect) => effect.stackingKey === "death-grace" || effect.id.includes("death-grace"));
}

function applyPartyTurnEndStatus(state: BattleState) {
  return {
    ...state,
    party: state.party.map((member) => {
      const maxHp = effectiveMaxHp(member, state);
      const damage = turnDamage(member.statusEffects);
      const damageAsHealing = hasDeathGrace(member) ? damage : 0;
      const hpAfterDamage = hasDeathGrace(member) ? member.hp : Math.max(0, member.hp - damage);
      const hp = Math.min(maxHp, hpAfterDamage + turnHealing(member, maxHp) + damageAsHealing);
      const chargeBar = member.statusEffects.some((effect) => effect.autoignition || effect.instantCharge)
        ? 100
        : Math.min(100, member.chargeBar + turnChargeBar(member, maxHp));
      const statusEffects = member.statusEffects.some((effect) => effect.stackingKey === "vaccine" || effect.id.includes("vaccine"))
        ? member.statusEffects.filter((effect) => effect.polarity !== "debuff")
        : member.statusEffects;

      return {
        ...member,
        hp,
        chargeBar,
        statusEffects,
      };
    }),
  };
}

function applyEnemyTurnEndStatus(state: BattleState) {
  const damage = turnDamage(state.enemy.statusEffects);
  return damage > 0
    ? {
        ...state,
        enemy: damageEnemy(state.enemy, damage),
      }
    : state;
}

function resolveCounters(state: BattleState) {
  const counterUsers = state.party.filter((member) => (member.counterStacks ?? 0) > 0 && member.hp > 0);
  if (counterUsers.length === 0 || state.enemy.hp <= 0) {
    return state;
  }

  return counterUsers.reduce((current, member, index) => {
    const breakdown = resolveHit({
      attacker: member,
      enemy: current.enemy,
      weaponGrid: current.weaponGrid,
      kind: "counter",
      hitMultiplier: 1.5,
      cap: NORMAL_ATTACK_CAP,
      criticalSeed: current.turn * 97 + index,
      randomVariance: current.options.randomVariance,
    });
    const enemy = damageEnemy(current.enemy, breakdown.finalDamage);
    const party = current.party.map((partyMember) =>
      partyMember.id === member.id ? { ...partyMember, counterStacks: 0 } : partyMember,
    );

    return {
      ...current,
      party,
      enemy,
      log: [
        ...current.log,
        makeLog(
          current,
          member.name,
          t.battle.counter,
          format(t.battle.counterDetail, {
            damage: breakdown.finalDamage.toLocaleString(),
            hits: breakdown.hitCount,
          }),
          breakdown.finalDamage,
          {
            feedback: "damage",
            targetId: current.enemy.id,
            targetType: "enemy",
            sourceId: member.id,
            sourceType: "party",
            sourceMotion: "attack",
            hitDamages: hitDamagesFromBreakdown(breakdown),
          },
        ),
      ],
    };
  }, state);
}

function triggerConditionMet(state: BattleState, trigger: Enemy["triggers"][number]) {
  const { condition } = trigger;
  if (trigger.once && state.enemy.triggeredIds.includes(trigger.id)) {
    return false;
  }

  if (condition.type === "hpBelow") {
    return state.enemy.hp / state.enemy.maxHp <= condition.threshold;
  }

  if (condition.type === "chargeFull") {
    return state.enemy.chargeDiamonds >= effectiveMaxChargeDiamonds(state.enemy);
  }

  if (condition.type === "status") {
    return state.enemy.statusEffects.some((effect) => effect.id === condition.statusId);
  }

  return false;
}

function resolveEnemyTriggers(state: BattleState, timing: Enemy["triggers"][number]["timing"]) {
  const trigger = state.enemy.triggers
    .filter((candidate) => candidate.timing === timing && triggerConditionMet(state, candidate))
    .sort((a, b) => b.priority - a.priority)[0];

  if (!trigger) {
    return state;
  }

  const withTriggeredId = {
    ...state,
    enemy: {
      ...state.enemy,
      triggeredIds: trigger.once ? [...state.enemy.triggeredIds, trigger.id] : state.enemy.triggeredIds,
    },
  };

  if (trigger.action.type === "fillCharge") {
    return {
      ...withTriggeredId,
      enemy: {
        ...withTriggeredId.enemy,
        chargeDiamonds: Math.min(
          effectiveMaxChargeDiamonds(withTriggeredId.enemy),
          withTriggeredId.enemy.chargeDiamonds + trigger.action.amount,
        ),
      },
      log: [
        ...withTriggeredId.log,
        makeLog(withTriggeredId, withTriggeredId.enemy.name, trigger.label, "触发器发动：CT 增加。"),
      ],
    };
  }

  if (trigger.action.type === "phaseChange") {
    return {
      ...withTriggeredId,
      enemy: { ...withTriggeredId.enemy, mode: trigger.action.mode },
      log: [
        ...withTriggeredId.log,
        makeLog(withTriggeredId, withTriggeredId.enemy.name, trigger.label, "敌方阶段变化。"),
      ],
    };
  }

  return resolveEnemySpecial(
    {
      ...withTriggeredId,
      enemy: { ...withTriggeredId.enemy, chargeDiamonds: effectiveMaxChargeDiamonds(withTriggeredId.enemy) },
    },
    trigger.action.multiplier,
  );
}

export function executeSkill(state: BattleState, actorId: string, skillId: string): BattleState {
  const actor = state.party.find((member) => member.id === actorId);
  const skill = actor?.skills.find((candidate) => candidate.id === skillId);

  if (!actor || !skill || skill.remainingCooldown > 0 || state.enemy.hp <= 0) {
    return state;
  }

  const actorIndex = state.party.findIndex((member) => member.id === actorId);
  const skillIndex = actor.skills.findIndex((candidate) => candidate.id === skillId);
  let nextState = structuredClone(state);
  const nextActor = nextState.party[actorIndex];
  nextActor.skills[skillIndex] = spendSkill(skill);

  if (skill.kind === "damage") {
    const hitCount = skill.hitCount ?? 1;
    const breakdown = resolveHit(
      {
        attacker: nextActor,
        enemy: nextState.enemy,
        weaponGrid: nextState.weaponGrid,
        kind: "skill",
        hitMultiplier: skill.damageMultiplier ?? 1,
        cap: skill.damageCap ?? 630000,
        criticalSeed: nextState.turn * 113 + actorIndex,
        randomVariance: nextState.options.randomVariance,
      },
      hitCount,
    );
    const totalDamage = breakdown.finalDamage;
    nextState.enemy = damageEnemy(nextState.enemy, totalDamage);
    nextActor.chargeBar = Math.min(100, nextActor.chargeBar + Math.round((skill.chargeGain ?? 0) * chargeGainMultiplier(nextActor)));
    nextState = applyDrain(nextState, nextActor.id, totalDamage);
    nextState.log.push(
      makeLog(
        nextState,
        nextActor.name,
        skill.label,
        format(t.battle.skillDamageDetail, {
          damage: totalDamage.toLocaleString(),
          hits: hitCount,
        }),
        totalDamage,
        {
          feedback: "damage",
          targetId: nextState.enemy.id,
          targetType: "enemy",
          sourceId: nextActor.id,
          sourceType: "party",
          sourceMotion: "skill",
          hitDamages: hitDamagesFromBreakdown(breakdown),
        },
      ),
    );
  }

  if (skill.kind === "buff" && skill.target === "party") {
    nextState.party = applyPartyStatus(nextState.party, skill.applies ?? []);
    nextState.log.push(
      makeLog(nextState, nextActor.name, skill.label, t.battle.partyBuffApplied, undefined, {
        feedback: "buff",
        targetId: nextActor.id,
        targetType: "party",
        sourceId: nextActor.id,
        sourceType: "party",
        sourceMotion: "skill",
      }),
    );
  }

  if (skill.kind === "buff" && skill.target === "self") {
    nextState.party = applySelfStatus(nextState.party, actorId, skill.applies ?? []);
    nextState.log.push(
      makeLog(nextState, nextActor.name, skill.label, t.battle.selfBuffApplied, undefined, {
        feedback: "buff",
        targetId: nextActor.id,
        targetType: "party",
        sourceId: nextActor.id,
        sourceType: "party",
        sourceMotion: "skill",
      }),
    );
  }

  if (skill.kind === "debuff") {
    const landedEffects = (skill.applies ?? []).filter((effect, index) =>
      debuffLands(nextState, effect, nextState.turn * 173 + index),
    );
    nextState.enemy.statusEffects = mergeStatusEffects(nextState.enemy.statusEffects, landedEffects);
    nextState.log.push(
      makeLog(
        nextState,
        nextActor.name,
        skill.label,
        landedEffects.length > 0 ? t.battle.enemyDebuffed : t.battle.debuffMissed,
        undefined,
        landedEffects.length > 0
          ? {
              feedback: "debuff",
              targetId: nextState.enemy.id,
              targetType: "enemy",
              sourceId: nextActor.id,
              sourceType: "party",
              sourceMotion: "skill",
            }
          : undefined,
      ),
    );
  }

  if (skill.kind === "delay") {
    nextState.enemy.chargeDiamonds = Math.max(0, nextState.enemy.chargeDiamonds - 1);
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, t.battle.enemyDelayed));
  }

  if (skill.kind === "dispel") {
    const dispelCancel = nextState.enemy.statusEffects.find((effect) => effect.dispelCancel);
    let removedBuff = false;
    nextState.enemy.statusEffects = dispelCancel
      ? nextState.enemy.statusEffects.filter((effect) => effect.id !== dispelCancel.id)
      : nextState.enemy.statusEffects.filter((effect) => {
          if (!removedBuff && effect.polarity === "buff") {
            removedBuff = true;
            return false;
          }
          return true;
        });
    nextState.log.push(
      makeLog(
        nextState,
        nextActor.name,
        skill.label,
        dispelCancel ? t.battle.dispelCancelConsumed : t.battle.enemyBuffDispelled,
      ),
    );
  }

  if (skill.kind === "substitute") {
    nextState.party[actorIndex] = {
      ...nextState.party[actorIndex],
      substituteForTeam: true,
      counterStacks: 0,
      statusEffects: [...nextState.party[actorIndex].statusEffects, ...structuredClone(skill.applies ?? [])],
    };
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, t.battle.substituteCounter));
  }

  if (skill.kind === "counter") {
    nextState.party[actorIndex] = {
      ...nextState.party[actorIndex],
      counterStacks: Math.max(1, nextState.party[actorIndex].counterStacks ?? 0),
      statusEffects: mergeStatusEffects(nextState.party[actorIndex].statusEffects, structuredClone(skill.applies ?? [])),
    };
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, t.battle.substituteCounter));
  }

  nextState = resolveEnemyTriggers(nextState, "afterSkill");

  return {
    ...nextState,
    lastActionSummary: `${actor.name} used ${skill.label}`,
  };
}

export function attackTurn(state: BattleState): BattleState {
  if (state.enemy.hp <= 0) {
    return state;
  }

  let nextState = structuredClone(state);
  let chainCount = 0;

  nextState.party.forEach((member, index) => {
    if (member.hp <= 0 || nextState.enemy.hp <= 0) {
      return;
    }

    if (member.chargeBar >= 100) {
      const breakdown = resolveHit({
        attacker: member,
        enemy: nextState.enemy,
        weaponGrid: nextState.weaponGrid,
        kind: "charge",
        hitMultiplier: member.chargeAttack.multiplier,
        cap: member.chargeAttack.cap,
        criticalSeed: nextState.turn * 131 + index,
        randomVariance: nextState.options.randomVariance,
      });
      const damage = breakdown.finalDamage + member.chargeAttack.fixedDamage;
      chainCount += 1;
      nextState.enemy = damageEnemy(nextState.enemy, damage);
      nextState.party[index].chargeBar = Math.round(10 * chargeGainMultiplier(member));
      nextState = applyDrain(nextState, member.id, damage);
      nextState.log.push(
        makeLog(
          nextState,
          member.name,
          member.chargeAttack.label,
          format(t.battle.chargeAttackDetail, {
            damage: damage.toLocaleString(),
            notes: breakdown.notes.join(" / "),
          }),
          damage,
          {
            feedback: "damage",
            targetId: nextState.enemy.id,
            targetType: "enemy",
            sourceId: member.id,
            sourceType: "party",
            sourceMotion: "skill",
            hitDamages: [
              ...hitDamagesFromBreakdown(breakdown),
              ...(member.chargeAttack.fixedDamage > 0 ? [member.chargeAttack.fixedDamage] : []),
            ],
          },
        ),
      );
      return;
    }

    const hits = normalHitCount(member, nextState.turn * 71 + index, nextState.weaponGrid.multiattack);
    const breakdown = resolveHit({
      attacker: member,
      enemy: nextState.enemy,
      weaponGrid: nextState.weaponGrid,
      kind: "normal",
      hitMultiplier: 1,
      cap: NORMAL_ATTACK_CAP,
      criticalSeed: nextState.turn * 71 + index,
      randomVariance: nextState.options.randomVariance,
    }, hits);
    nextState.enemy = damageEnemy(nextState.enemy, breakdown.finalDamage);
    nextState.party[index].chargeBar = Math.min(100, member.chargeBar + Math.round((10 + hits * 7) * chargeGainMultiplier(member)));
    nextState = applyDrain(nextState, member.id, breakdown.finalDamage);
    nextState.log.push(
      makeLog(
        nextState,
        member.name,
        hits === 3
          ? t.battle.attackNames.triple
          : hits === 2
            ? t.battle.attackNames.double
            : t.battle.attackNames.single,
        format(t.battle.normalAttackDetail, {
          damage: breakdown.finalDamage.toLocaleString(),
          hits,
          notes: breakdown.notes.join(" / "),
        }),
        breakdown.finalDamage,
        {
          feedback: "damage",
          targetId: nextState.enemy.id,
          targetType: "enemy",
          sourceId: member.id,
          sourceType: "party",
          sourceMotion: "attack",
          hitDamages: hitDamagesFromBreakdown(breakdown),
        },
      ),
    );
  });

  if (chainCount >= 2 && nextState.enemy.hp > 0) {
    const chainDamage = Math.round(
      Math.min(CHAIN_BURST_CAP * (1 + (chainCount - 2) * 0.25), nextState.enemy.maxHp * 0.18),
    );
    nextState.enemy = damageEnemy(nextState.enemy, chainDamage);
    nextState.log.push(
      makeLog(
        nextState,
        t.panels.party,
        format(t.battle.chainBurst, { count: chainCount }),
        format(t.battle.chainBurstDetail, { damage: chainDamage.toLocaleString() }),
        chainDamage,
        {
          feedback: "damage",
          targetId: nextState.enemy.id,
          targetType: "enemy",
          hitDamages: [chainDamage],
        },
      ),
    );
  }

  nextState.chainCount = chainCount;
  nextState = resolveEnemyTriggers(nextState, "afterAttack");
  nextState = resolveEnemyAction(nextState);
  nextState = resolveCounters(nextState);

  return endTurn(
    nextState,
    chainCount > 0
      ? format(t.battle.chainResolved, { count: chainCount })
      : t.battle.normalTurnResolved,
  );
}

function endTurn(state: BattleState, summary: string): BattleState {
  const triggered = applyEnemyTurnEndStatus(applyPartyTurnEndStatus(resolveEnemyTriggers(state, "endTurn")));
  const party = triggered.party.map((member) => ({
    ...member,
    substituteForTeam: false,
    statusEffects: member.statusEffects.map(tickStatus).filter((effect) => effect.duration > 0),
    skills: member.skills.map(nextCooldown),
  }));
  const enemy: Enemy = {
    ...triggered.enemy,
    statusEffects: triggered.enemy.statusEffects.map(tickStatus).filter((effect) => effect.duration > 0),
    mode: triggered.enemy.hp <= 0 ? "break" : triggered.enemy.mode,
  };

  return {
    ...triggered,
    turn: triggered.turn + 1,
    party,
    enemy,
    lastActionSummary: summary,
  };
}
