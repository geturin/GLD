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

function mergeStatusEffects(currentEffects: StatusEffect[], incomingEffects: StatusEffect[]) {
  return incomingEffects.reduce((effects, incoming) => {
    const next = structuredClone(incoming);
    const existingIndex = effects.findIndex((effect) => {
      if (next.stackingRule === "unique") {
        return effect.id === next.id;
      }

      return (
        effect.stackingSide &&
        next.stackingSide &&
        effect.stackingSide === next.stackingSide &&
        effect.label === next.label
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
    const existingPower =
      (existing.attackDown ?? 0) +
      (existing.defenseDown ?? 0) +
      (existing.defenseUp ?? 0) +
      (existing.modifiers?.reduce((sum, modifier) => sum + modifier.value, 0) ?? 0);
    const nextPower =
      (next.attackDown ?? 0) +
      (next.defenseDown ?? 0) +
      (next.defenseUp ?? 0) +
      (next.modifiers?.reduce((sum, modifier) => sum + modifier.value, 0) ?? 0);

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
  const resistanceDown = state.enemy.statusEffects.reduce(
    (total, status) => total + (status.debuffResistanceDown ?? 0),
    0,
  );
  const accuracy = effect.accuracy ?? 1;
  const resistance = Math.max(0, state.enemy.debuffResistance - resistanceDown);
  return deterministicRoll(seed, effect.id) <= Math.max(0, accuracy - resistance);
}

function resolveEnemySpecial(state: BattleState, multiplier = 1) {
  if (state.enemy.chargeDiamonds < state.enemy.maxChargeDiamonds || state.enemy.hp <= 0) {
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
  const effectiveMaxHp = target.maxHp + state.weaponGrid.hp;
  const rawDamage = Math.round(
    effectiveAttack *
      (state.enemy.mode === "overdrive" ? 1.7 : 1.25) *
      multiplier *
      (1 - damageCut) *
      (1 - damageReduction),
  );
  const nextParty = state.party.map((member) =>
    member.id === target.id
      ? {
          ...member,
          hp: Math.max(0, member.hp - rawDamage),
          chargeBar: Math.min(
            100,
            member.chargeBar + Math.max(5, Math.round((rawDamage / effectiveMaxHp) * 50)),
          ),
          counterStacks: member.counterStacks ? member.counterStacks + 1 : member.counterStacks,
        }
      : member,
  );

  return {
    ...state,
    party: nextParty,
    enemy: { ...state.enemy, chargeDiamonds: 0 },
    log: [
      ...state.log,
      makeLog(
        state,
        state.enemy.name,
        state.enemy.mode === "overdrive" ? t.battle.overdriveTrigger : t.battle.specialAttack,
        format(t.battle.takesDamage, {
          damage: rawDamage.toLocaleString(),
          target: target.name,
        }),
        rawDamage,
        {
          feedback: "damage",
          targetId: target.id,
          targetType: "party",
          hitDamages: [rawDamage],
        },
      ),
    ],
  };
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
    return state.enemy.chargeDiamonds >= state.enemy.maxChargeDiamonds;
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
          withTriggeredId.enemy.maxChargeDiamonds,
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
      enemy: { ...withTriggeredId.enemy, chargeDiamonds: withTriggeredId.enemy.maxChargeDiamonds },
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
    nextActor.chargeBar = Math.min(100, nextActor.chargeBar + (skill.chargeGain ?? 0));
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
        landedEffects.length > 0 ? t.battle.enemyDebuffed : "弱体未命中。",
        undefined,
        landedEffects.length > 0
          ? {
              feedback: "debuff",
              targetId: nextState.enemy.id,
              targetType: "enemy",
            }
          : undefined,
      ),
    );
  }

  if (skill.kind === "delay") {
    nextState.enemy.chargeDiamonds = Math.max(0, nextState.enemy.chargeDiamonds - 1);
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, t.battle.enemyDelayed));
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
      nextState.party[index].chargeBar = 10;
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
    nextState.party[index].chargeBar = Math.min(100, member.chargeBar + 10 + hits * 7);
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

  nextState.enemy.chargeDiamonds = Math.min(
    nextState.enemy.maxChargeDiamonds,
    nextState.enemy.chargeDiamonds + (nextState.enemy.mode === "break" ? 0 : 1),
  );
  nextState.chainCount = chainCount;
  nextState = resolveEnemyTriggers(nextState, "afterAttack");
  nextState = resolveEnemySpecial(nextState);
  nextState = resolveCounters(nextState);

  return endTurn(
    nextState,
    chainCount > 0
      ? format(t.battle.chainResolved, { count: chainCount })
      : t.battle.normalTurnResolved,
  );
}

function endTurn(state: BattleState, summary: string): BattleState {
  const triggered = resolveEnemyTriggers(state, "endTurn");
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
