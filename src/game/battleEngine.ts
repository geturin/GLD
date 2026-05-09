import { enemyModeAfterDamage, normalHitCount, resolveHit } from "./formulas";
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

function makeLog(
  state: BattleState,
  actor: string,
  action: string,
  detail: string,
  damage?: number,
): BattleLogEntry {
  return {
    id: `${state.turn}-${state.log.length}-${actor}-${action}`,
    turn: state.turn,
    actor,
    action,
    detail,
    damage,
  };
}

function tickStatus(effect: StatusEffect) {
  return { ...effect, duration: effect.duration - 1 };
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
    statusEffects: [...member.statusEffects, ...structuredClone(effects)],
  }));
}

function applySelfStatus(party: Combatant[], actorId: string, effects: StatusEffect[]) {
  if (effects.length === 0) {
    return party;
  }

  return party.map((member) =>
    member.id === actorId
      ? { ...member, statusEffects: [...member.statusEffects, ...structuredClone(effects)] }
      : member,
  );
}

function resolveEnemySpecial(state: BattleState) {
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
  const rawDamage = Math.round(effectiveAttack * (state.enemy.mode === "overdrive" ? 1.7 : 1.25));
  const nextParty = state.party.map((member) =>
    member.id === target.id
      ? {
          ...member,
          hp: Math.max(0, member.hp - rawDamage),
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
        state.enemy.mode === "overdrive" ? "Overdrive trigger" : "Special attack",
        `${target.name} takes ${rawDamage.toLocaleString()} damage.`,
        rawDamage,
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
          "Counter",
          `${breakdown.hitCount} hit for ${breakdown.finalDamage.toLocaleString()} damage.`,
          breakdown.finalDamage,
        ),
      ],
    };
  }, state);
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
        `${hitCount} skill hits for ${totalDamage.toLocaleString()} damage.`,
        totalDamage,
      ),
    );
  }

  if (skill.kind === "buff" && skill.target === "party") {
    nextState.party = applyPartyStatus(nextState.party, skill.applies ?? []);
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, "Party gains ATK Up."));
  }

  if (skill.kind === "buff" && skill.target === "self") {
    nextState.party = applySelfStatus(nextState.party, actorId, skill.applies ?? []);
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, "Self gains unique ATK Up."));
  }

  if (skill.kind === "debuff") {
    nextState.enemy.statusEffects = [...nextState.enemy.statusEffects, ...structuredClone(skill.applies ?? [])];
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, "Enemy ATK and DEF are reduced."));
  }

  if (skill.kind === "delay") {
    nextState.enemy.chargeDiamonds = Math.max(0, nextState.enemy.chargeDiamonds - 1);
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, "Enemy charge diamond delayed."));
  }

  if (skill.kind === "substitute") {
    nextState.party[actorIndex] = {
      ...nextState.party[actorIndex],
      substituteForTeam: true,
      counterStacks: 0,
      statusEffects: [...nextState.party[actorIndex].statusEffects, ...structuredClone(skill.applies ?? [])],
    };
    nextState.log.push(makeLog(nextState, nextActor.name, skill.label, "Will cover allies and counter."));
  }

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
          `${damage.toLocaleString()} CA damage. ${breakdown.notes.join(", ")}.`,
          damage,
        ),
      );
      return;
    }

    const hits = normalHitCount(member, nextState.turn * 71 + index);
    const breakdown = resolveHit({
      attacker: member,
      enemy: nextState.enemy,
      weaponGrid: nextState.weaponGrid,
      kind: "normal",
      hitMultiplier: 1,
      cap: NORMAL_ATTACK_CAP,
      criticalSeed: nextState.turn * 71 + index,
    }, hits);
    nextState.enemy = damageEnemy(nextState.enemy, breakdown.finalDamage);
    nextState.party[index].chargeBar = Math.min(100, member.chargeBar + 10 + hits * 7);
    nextState.log.push(
      makeLog(
        nextState,
        member.name,
        hits === 3 ? "Triple attack" : hits === 2 ? "Double attack" : "Attack",
        `${hits} hit(s) for ${breakdown.finalDamage.toLocaleString()} damage. ${breakdown.notes.join(", ")}.`,
        breakdown.finalDamage,
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
        "Party",
        `${chainCount}-chain burst`,
        `${chainDamage.toLocaleString()} bonus elemental damage.`,
        chainDamage,
      ),
    );
  }

  nextState.enemy.chargeDiamonds = Math.min(
    nextState.enemy.maxChargeDiamonds,
    nextState.enemy.chargeDiamonds + (nextState.enemy.mode === "break" ? 0 : 1),
  );
  nextState.chainCount = chainCount;
  nextState = resolveEnemySpecial(nextState);
  nextState = resolveCounters(nextState);

  return endTurn(nextState, chainCount > 0 ? `${chainCount}-chain attack resolved` : "Normal attack turn resolved");
}

function endTurn(state: BattleState, summary: string): BattleState {
  const party = state.party.map((member) => ({
    ...member,
    substituteForTeam: false,
    statusEffects: member.statusEffects.map(tickStatus).filter((effect) => effect.duration > 0),
    skills: member.skills.map(nextCooldown),
  }));
  const enemy: Enemy = {
    ...state.enemy,
    statusEffects: state.enemy.statusEffects.map(tickStatus).filter((effect) => effect.duration > 0),
    mode: state.enemy.hp <= 0 ? "break" : state.enemy.mode,
  };

  return {
    ...state,
    turn: state.turn + 1,
    party,
    enemy,
    lastActionSummary: summary,
  };
}
