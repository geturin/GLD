import type { BattleState, Combatant, Enemy, SkillDefinition, WeaponGrid } from "./types";

export const demoWeaponGrid: WeaponGrid = {
  name: "Demo Fire Grid",
  attack: 22000,
  modifiers: [
    { id: "normal-atk", label: "Normal ATK", bucket: "normal", value: 0.25 },
    { id: "omega-atk", label: "Omega ATK", bucket: "omega", value: 0 },
    { id: "ex-atk", label: "EX ATK", bucket: "ex", value: 0.18 },
    { id: "stamina-atk", label: "Stamina", bucket: "stamina", value: 0 },
    { id: "enmity-atk", label: "Enmity", bucket: "enmity", value: 0 },
    { id: "skill-dmg", label: "Skill DMG", bucket: "skillDamage", value: 0 },
    { id: "ca-dmg", label: "C.A. DMG", bucket: "caDamage", value: 0 },
    { id: "amplified-dmg", label: "DMG Amplified", bucket: "amplified", value: 0 },
  ],
  critical: [{ id: "demo-crit", label: "Demo critical", chance: 0.25, damage: 0.5 }],
  capUp: [
    {
      id: "normal-cap-up",
      label: "Normal DMG Cap",
      source: "weapon",
      appliesTo: ["normal", "counter"],
      value: 0,
    },
    {
      id: "skill-cap-up",
      label: "Skill DMG Cap",
      source: "weapon",
      appliesTo: ["skill"],
      value: 0,
    },
    {
      id: "ca-cap-up",
      label: "C.A. DMG Cap",
      source: "weapon",
      appliesTo: ["charge"],
      value: 0,
    },
  ],
  supplemental: [
    {
      id: "normal-supp",
      label: "Normal Supplemental",
      amount: 0,
      appliesTo: ["normal", "counter"],
    },
    {
      id: "skill-supp",
      label: "Skill Supplemental",
      amount: 0,
      appliesTo: ["skill"],
    },
    {
      id: "ca-supp",
      label: "C.A. Supplemental",
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
    label: "Battle Orders",
    cooldown: DEMO_SKILL_VALUES.teamAttackBuff.cooldown,
    remainingCooldown: 0,
    kind: "buff",
    target: "party",
    applies: [
      {
        id: "team-atk-up-buff",
        label: "Team ATK Up",
        duration: DEMO_SKILL_VALUES.teamAttackBuff.duration,
        modifiers: [
          {
            id: "team-atk-up-normal",
            label: "Team ATK Up",
            bucket: "normal",
            value: DEMO_SKILL_VALUES.teamAttackBuff.attackUp,
          },
        ],
      },
    ],
  },
  {
    id: "atk-def-down",
    label: "Fracture Mark",
    cooldown: DEMO_SKILL_VALUES.enemyAtkDefDown.cooldown,
    remainingCooldown: 0,
    kind: "debuff",
    target: "enemy",
    applies: [
      {
        id: "atk-def-down-debuff",
        label: "ATK / DEF Down",
        duration: DEMO_SKILL_VALUES.enemyAtkDefDown.duration,
        attackDown: DEMO_SKILL_VALUES.enemyAtkDefDown.attackDown,
        defenseDown: DEMO_SKILL_VALUES.enemyAtkDefDown.defenseDown,
      },
    ],
  },
  {
    id: "self-unique-up",
    label: "Limit Stance",
    cooldown: DEMO_SKILL_VALUES.selfUniqueBurst.cooldown,
    remainingCooldown: 0,
    kind: "buff",
    target: "self",
    applies: [
      {
        id: "self-unique-up-buff",
        label: "Unique ATK Up",
        duration: DEMO_SKILL_VALUES.selfUniqueBurst.duration,
        modifiers: [
          {
            id: "self-unique-up-mod",
            label: "Unique ATK Up",
            bucket: "unique",
            value: DEMO_SKILL_VALUES.selfUniqueBurst.uniqueAttackUp,
          },
        ],
      },
    ],
  },
  {
    id: "triple-strike",
    label: "Triple Brand",
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
    name: "Aster",
    role: "Single-character combat demo",
    maxHp: 16000,
    hp: 16000,
    baseAttack: 9800,
    chargeBar: 50,
    multiattack: { double: 0.24, triple: 0.08 },
    chargeAttack: {
      label: "Crimson Drive",
      multiplier: 4.5,
      cap: 1_685_000,
      fixedDamage: 2000,
    },
    skills: demoSkills,
    personalModifiers: [
      { id: "unique-passive", label: "Unique Passive", bucket: "unique", value: 0 },
      { id: "seraphic-passive", label: "Seraphic", bucket: "seraphic", value: 0 },
    ],
    critical: [],
    bonusDamage: [{ id: "normal-echo", label: "Bonus DMG", multiplier: 0 }],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  },
];

export const demoEnemy: Enemy = {
  id: "foundry-warden",
  name: "Foundry Warden",
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
        actor: "System",
        action: "Encounter",
        detail: "Single-character GBF-like battle demo started.",
      },
    ],
    chainCount: 0,
    lastActionSummary: "Ready",
  };
}
