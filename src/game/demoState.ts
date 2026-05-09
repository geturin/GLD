import type { BattleState, Combatant, Enemy, SkillDefinition, WeaponGrid } from "./types";
import { t } from "../i18n/zhCN";

export const demoWeaponGrid: WeaponGrid = {
  name: t.demo.gridName,
  attack: 22000,
  modifiers: [
    { id: "normal-atk", label: t.demo.labels.normalAttack, bucket: "normal", value: 0.25 },
    { id: "omega-atk", label: t.demo.labels.omegaAttack, bucket: "omega", value: 0 },
    { id: "ex-atk", label: t.demo.labels.exAttack, bucket: "ex", value: 0.18 },
    { id: "stamina-atk", label: t.demo.labels.stamina, bucket: "stamina", value: 0 },
    { id: "enmity-atk", label: t.demo.labels.enmity, bucket: "enmity", value: 0 },
    { id: "skill-dmg", label: t.demo.labels.skillDamage, bucket: "skillDamage", value: 0 },
    { id: "ca-dmg", label: t.demo.labels.chargeAttackDamage, bucket: "caDamage", value: 0 },
    { id: "amplified-dmg", label: t.demo.labels.amplifiedDamage, bucket: "amplified", value: 0 },
  ],
  critical: [{ id: "demo-crit", label: t.demo.labels.demoCritical, chance: 0.25, damage: 0.5 }],
  capUp: [
    {
      id: "normal-cap-up",
      label: t.demo.labels.normalCap,
      source: "weapon",
      appliesTo: ["normal", "counter"],
      value: 0,
    },
    {
      id: "skill-cap-up",
      label: t.demo.labels.skillCap,
      source: "weapon",
      appliesTo: ["skill"],
      value: 0,
    },
    {
      id: "ca-cap-up",
      label: t.demo.labels.chargeAttackCap,
      source: "weapon",
      appliesTo: ["charge"],
      value: 0,
    },
  ],
  supplemental: [
    {
      id: "normal-supp",
      label: t.demo.labels.normalSupplemental,
      amount: 0,
      appliesTo: ["normal", "counter"],
    },
    {
      id: "skill-supp",
      label: t.demo.labels.skillSupplemental,
      amount: 0,
      appliesTo: ["skill"],
    },
    {
      id: "ca-supp",
      label: t.demo.labels.chargeAttackSupplemental,
      amount: 0,
      appliesTo: ["charge"],
    },
  ],
};

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
    bonusDamage: [{ id: "normal-echo", label: t.demo.labels.bonusDamage, multiplier: 0 }],
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
  statusEffects: [],
};

export function createInitialBattleState(): BattleState {
  return {
    turn: 1,
    party: structuredClone(demoParty),
    enemy: structuredClone(demoEnemy),
    weaponGrid: structuredClone(demoWeaponGrid),
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
  };
}
