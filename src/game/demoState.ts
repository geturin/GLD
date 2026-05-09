import type { BattleState, Combatant, Enemy, SummonSetup, WeaponGrid } from "./types";

export const demoWeaponGrid: WeaponGrid = {
  name: "Prototype Fire Magna Grid",
  attack: 37200,
  modifiers: [
    { id: "normal-atk", label: "Normal ATK", bucket: "normal", value: 0.32 },
    { id: "omega-atk", label: "Omega ATK", bucket: "omega", value: 1.05 },
    { id: "ex-atk", label: "EX ATK", bucket: "ex", value: 0.21 },
    { id: "seraphic-edge", label: "Seraphic", bucket: "seraphic", value: 0.2 },
    { id: "grid-stamina", label: "Stamina", bucket: "stamina", value: 0.18 },
  ],
  critical: [{ id: "magna-crit", label: "Magna critical", chance: 0.45, damage: 0.5 }],
  capUp: [
    {
      id: "opus-cap",
      label: "Weapon cap up",
      source: "weapon",
      appliesTo: ["normal", "charge", "skill", "counter"],
      value: 0.1,
    },
  ],
  supplemental: [
    {
      id: "covenant-supp",
      label: "Grid supplemental",
      amount: 18000,
      appliesTo: ["normal", "counter"],
    },
  ],
};

export const demoSummons: SummonSetup = {
  main: {
    name: "Colossus Omega",
    aura: [{ id: "main-omega-aura", label: "Omega aura", bucket: "omega", value: 0.7 }],
    capUp: [],
  },
  support: {
    name: "Shiva",
    aura: [{ id: "support-element-aura", label: "Elemental aura", bucket: "elemental", value: 1.4 }],
    call: {
      id: "shiva-call",
      label: "Shiva call",
      duration: 1,
      modifiers: [{ id: "shiva-unique", label: "Unique burst", bucket: "unique", value: 0.6 }],
      capUp: [
        {
          id: "shiva-cap",
          label: "Call cap up",
          source: "summon",
          appliesTo: ["normal", "charge"],
          value: 0.3,
        },
      ],
    },
  },
};

const commonChargeAttack = {
  multiplier: 4.5,
  cap: 1_685_000,
  fixedDamage: 2000,
};

export const demoParty: Combatant[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    role: "MC / Defender",
    element: "fire",
    maxHp: 18420,
    hp: 18420,
    baseAttack: 9850,
    chargeBar: 80,
    multiattack: { double: 0.28, triple: 0.12 },
    chargeAttack: { label: "Ignition Cleave", ...commonChargeAttack },
    skills: [
      {
        id: "rally",
        label: "Rallying Brand",
        cooldown: 6,
        remainingCooldown: 0,
        kind: "buff",
        applies: [
          {
            id: "rally-buff",
            label: "ATK / DATA Up",
            duration: 3,
            modifiers: [{ id: "rally-normal", label: "Normal ATK Up", bucket: "normal", value: 0.3 }],
            multiattack: { double: 0.25, triple: 0.12 },
          },
        ],
      },
      {
        id: "cover-counter",
        label: "Substitute Counter",
        cooldown: 5,
        remainingCooldown: 0,
        kind: "substitute",
        applies: [{ id: "substitute", label: "Substitute + Counter", duration: 1 }],
      },
    ],
    personalModifiers: [],
    critical: [],
    bonusDamage: [{ id: "fire-echo", label: "Fire echo", multiplier: 0.2 }],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  },
  {
    id: "hexblade",
    name: "Hexblade",
    role: "Attacker",
    element: "fire",
    maxHp: 13880,
    hp: 13880,
    baseAttack: 11240,
    chargeBar: 100,
    multiattack: { double: 0.34, triple: 0.18 },
    chargeAttack: { label: "Scarlet Ruin", ...commonChargeAttack },
    skills: [
      {
        id: "slash",
        label: "Ruin Slash",
        cooldown: 5,
        remainingCooldown: 0,
        kind: "damage",
        hitCount: 4,
        damageMultiplier: 1.2,
        damageCap: 185000,
        chargeGain: 12,
      },
    ],
    personalModifiers: [{ id: "hex-unique", label: "Blade stance", bucket: "unique", value: 0.18 }],
    critical: [{ id: "hex-crit", label: "Keen edge", chance: 0.25, damage: 0.3 }],
    bonusDamage: [],
    supplemental: [{ id: "hex-supp", label: "Personal supplemental", amount: 12000, appliesTo: ["normal", "skill"] }],
    capUp: [],
    statusEffects: [],
  },
  {
    id: "cantor",
    name: "Cantor",
    role: "Buffer",
    element: "fire",
    maxHp: 12760,
    hp: 12760,
    baseAttack: 8940,
    chargeBar: 72,
    multiattack: { double: 0.22, triple: 0.08 },
    chargeAttack: { label: "Harmonic Flare", ...commonChargeAttack },
    skills: [
      {
        id: "chorus",
        label: "Capstone Chorus",
        cooldown: 7,
        remainingCooldown: 0,
        kind: "buff",
        applies: [
          {
            id: "chorus-buff",
            label: "DMG Cap / Supplemental",
            duration: 3,
            capUp: [
              {
                id: "chorus-cap",
                label: "Buff cap up",
                source: "buff",
                appliesTo: ["normal", "charge", "skill"],
                value: 0.15,
              },
            ],
            supplemental: [{ id: "chorus-supp", label: "Song supplemental", amount: 24000, appliesTo: ["normal", "charge"] }],
          },
        ],
      },
    ],
    personalModifiers: [],
    critical: [],
    bonusDamage: [],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  },
  {
    id: "mender",
    name: "Mender",
    role: "Healer / Debuffer",
    element: "fire",
    maxHp: 14210,
    hp: 14210,
    baseAttack: 8360,
    chargeBar: 45,
    multiattack: { double: 0.2, triple: 0.06 },
    chargeAttack: { label: "Redemption Spark", ...commonChargeAttack },
    skills: [
      {
        id: "weaken",
        label: "Ashen Hex",
        cooldown: 6,
        remainingCooldown: 0,
        kind: "debuff",
        applies: [{ id: "def-down", label: "DEF Down", duration: 4, defenseDown: 0.25 }],
      },
      {
        id: "delay",
        label: "Seal Pulse",
        cooldown: 7,
        remainingCooldown: 0,
        kind: "delay",
      },
    ],
    personalModifiers: [],
    critical: [],
    bonusDamage: [],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  },
];

export const demoEnemy: Enemy = {
  id: "foundry-warden",
  name: "Foundry Warden",
  element: "wind",
  maxHp: 11_500_000,
  hp: 11_500_000,
  attack: 9200,
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
    summons: structuredClone(demoSummons),
    log: [
      {
        id: "battle-start",
        turn: 1,
        actor: "System",
        action: "Encounter",
        detail: "Foundry Warden blocks the route.",
      },
    ],
    chainCount: 0,
    lastActionSummary: "Ready",
  };
}
