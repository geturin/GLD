import type { BattleState, Combatant, Enemy, SkillDefinition } from "./types";
import { t } from "../i18n/zhCN";
import { createDemoWeaponGrid } from "./weaponGrid";

export const DEMO_SKILL_VALUES = {
  teamAttackBuff: {
    attackUp: 0.1,
    duration: 3,
    cooldown: 5,
  },
  enemyAtkDefDown: {
    attackDown: 0.1,
    defenseDown: 0.1,
    duration: 3,
    cooldown: 5,
  },
  selfUniqueBurst: {
    uniqueAttackUp: 0.3,
    duration: 1,
    cooldown: 6,
  },
  tripleStrike: {
    hitCount: 3,
    damageMultiplier: 1,
    damageCap: 200_000,
    cooldown: 5,
    chargeGain: 10,
  },
} as const;

export const demoSkills: SkillDefinition[] = [
  {
    id: "team-atk-up",
    label: t.demo.skills.battleOrders,
    cooldown: DEMO_SKILL_VALUES.teamAttackBuff.cooldown,
    remainingCooldown: 0,
    kind: "buff",
    target: "party",
    applies: [
      {
        id: "team-atk-up-buff",
        label: t.demo.labels.teamAttackUp,
        duration: DEMO_SKILL_VALUES.teamAttackBuff.duration,
        polarity: "buff",
        stackingSide: "normal",
        stackingRule: "replace",
        modifiers: [
          {
            id: "team-atk-up-normal",
            label: t.demo.labels.teamAttackUp,
            bucket: "normal",
            value: DEMO_SKILL_VALUES.teamAttackBuff.attackUp,
          },
        ],
      },
    ],
  },
  {
    id: "atk-def-down",
    label: t.demo.skills.fractureMark,
    cooldown: DEMO_SKILL_VALUES.enemyAtkDefDown.cooldown,
    remainingCooldown: 0,
    kind: "debuff",
    target: "enemy",
    applies: [
      {
        id: "atk-def-down-debuff",
        label: t.demo.labels.attackDefenseDown,
        duration: DEMO_SKILL_VALUES.enemyAtkDefDown.duration,
        polarity: "debuff",
        stackingSide: "dual",
        stackingRule: "replace",
        accuracy: 0.9,
        attackDown: DEMO_SKILL_VALUES.enemyAtkDefDown.attackDown,
        defenseDown: DEMO_SKILL_VALUES.enemyAtkDefDown.defenseDown,
      },
    ],
  },
  {
    id: "self-unique-up",
    label: t.demo.skills.limitStance,
    cooldown: DEMO_SKILL_VALUES.selfUniqueBurst.cooldown,
    remainingCooldown: 0,
    kind: "buff",
    target: "self",
    applies: [
      {
        id: "self-unique-up-buff",
        label: t.demo.labels.uniqueAttackUp,
        duration: DEMO_SKILL_VALUES.selfUniqueBurst.duration,
        polarity: "buff",
        stackingSide: "unique",
        stackingRule: "replace",
        modifiers: [
          {
            id: "self-unique-up-mod",
            label: t.demo.labels.uniqueAttackUp,
            bucket: "unique",
            value: DEMO_SKILL_VALUES.selfUniqueBurst.uniqueAttackUp,
          },
        ],
      },
    ],
  },
  {
    id: "triple-strike",
    label: t.demo.skills.tripleBrand,
    cooldown: DEMO_SKILL_VALUES.tripleStrike.cooldown,
    remainingCooldown: 0,
    kind: "damage",
    target: "enemy",
    hitCount: DEMO_SKILL_VALUES.tripleStrike.hitCount,
    damageMultiplier: DEMO_SKILL_VALUES.tripleStrike.damageMultiplier,
    damageCap: DEMO_SKILL_VALUES.tripleStrike.damageCap,
    chargeGain: DEMO_SKILL_VALUES.tripleStrike.chargeGain,
  },
];

export const demoParty: Combatant[] = [
  {
    id: "demo-hero",
    name: t.demo.heroName,
    role: t.demo.heroRole,
    maxHp: 16000,
    hp: 16000,
    baseAttack: 9800,
    chargeBar: 50,
    multiattack: { double: 0.24, triple: 0.08 },
    chargeAttack: {
      label: t.demo.chargeAttack,
      multiplier: 4.5,
      cap: 1_685_000,
      fixedDamage: 2000,
    },
    skills: demoSkills,
    personalModifiers: [
      { id: "unique-passive", label: t.demo.labels.uniquePassive, bucket: "unique", value: 0 },
      { id: "seraphic-passive", label: t.demo.labels.seraphic, bucket: "seraphic", value: 0 },
    ],
    critical: [],
    bonusDamage: [
      {
        id: "normal-echo",
        label: t.demo.labels.bonusDamage,
        multiplier: 0,
        appliesTo: ["normal", "counter"],
      },
    ],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  },
];

export const demoEnemy: Enemy = {
  id: "foundry-warden",
  name: t.demo.enemyName,
  maxHp: 5_000_000,
  hp: 5_000_000,
  attack: 8500,
  defense: 10,
  chargeDiamonds: 1,
  maxChargeDiamonds: 3,
  mode: "normal",
  modeGauge: 1,
  debuffResistance: 0.1,
  statusEffects: [],
  triggers: [
    {
      id: "hp-50-special",
      label: "HP 50% 触发",
      timing: "afterAttack",
      once: true,
      priority: 100,
      condition: { type: "hpBelow", threshold: 0.5 },
      action: { type: "specialAttack", multiplier: 1.2 },
    },
    {
      id: "overdrive-phase",
      label: "Overdrive 阶段",
      timing: "afterAttack",
      once: true,
      priority: 80,
      condition: { type: "hpBelow", threshold: 0.7 },
      action: { type: "phaseChange", mode: "overdrive" },
    },
  ],
  triggeredIds: [],
};

export function createInitialBattleState(): BattleState {
  return {
    turn: 1,
    party: structuredClone(demoParty),
    enemy: structuredClone(demoEnemy),
    weaponGrid: createDemoWeaponGrid(demoParty.length),
    log: [
      {
        id: "battle-start",
        turn: 1,
        actor: t.battle.system,
        action: t.battle.encounter,
        detail: t.battle.encounterDetail,
      },
    ],
    chainCount: 0,
    lastActionSummary: t.battle.ready,
    options: {
      randomVariance: true,
    },
  };
}
