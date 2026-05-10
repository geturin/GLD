import { t } from "../i18n/zhCN";
import type {
  BonusDamageRule,
  CriticalRule,
  DamageCapModifier,
  EquippedWeapon,
  MultiattackProfile,
  ScalarModifier,
  SupplementalRule,
  WeaponDefinition,
  WeaponGrid,
  WeaponSkillEffects,
} from "./types";

export const MAINHAND_SLOT_COUNT = 4;
export const SUB_SLOT_COUNT = 9;

export const WEAPON_CATALOG: WeaponDefinition[] = [
  {
    id: "luminous-blade",
    name: t.weapons.luminousBlade.name,
    series: t.weapons.series.luminous,
    weaponType: "sword",
    attack: 3464,
    hp: 262,
    skills: [
      {
        id: "luminous-skill-supplemental",
        label: t.weapons.luminousBlade.skill1,
        description: t.weapons.luminousBlade.description1,
        effects: {
          supplemental: [
            {
              id: "luminous-skill-supp",
              label: t.weapons.luminousBlade.skill1,
              amount: 100_000,
              appliesTo: ["skill"],
              cap: 100_000,
              condition: "always",
              sourceType: "weapon",
              boostable: true,
            },
          ],
        },
      },
      {
        id: "luminous-skill-follow-up",
        label: t.weapons.luminousBlade.skill2,
        description: t.weapons.luminousBlade.description2,
        effects: {
          bonusDamage: [
            {
              id: "luminous-skill-echo",
              label: t.weapons.luminousBlade.skill2,
              multiplier: 0.1,
              appliesTo: ["skill"],
              cap: 300_000,
              boostable: true,
            },
          ],
        },
      },
    ],
  },
  {
    id: "ephes-like",
    name: t.weapons.ephes.name,
    series: t.weapons.series.optimus,
    weaponType: "sword",
    attack: 3357,
    hp: 283,
    skills: [
      {
        id: "ephes-boost",
        label: t.weapons.ephes.skill1,
        description: t.weapons.ephes.description1,
        effects: {
          skillBoost: 0.3,
        },
      },
      {
        id: "ephes-crit",
        label: t.weapons.ephes.skill2,
        description: t.weapons.ephes.description2,
        effects: {
          modifiers: [
            {
              id: "ephes-normal-atk",
              label: t.demo.labels.normalAttack,
              bucket: "normal",
              value: 0.12,
              boostable: true,
            },
          ],
          critical: [
            {
              id: "ephes-critical",
              label: t.weapons.ephes.skill2,
              chance: 0.12,
              damage: 0.5,
              boostable: true,
            },
          ],
          supplemental: [
            {
              id: "ephes-critical-supp",
              label: t.weapons.ephes.skill3,
              amount: 30_000,
              appliesTo: ["normal", "skill", "charge"],
              cap: 100_000,
              condition: "critical",
              sourceType: "weapon",
              boostable: true,
            },
          ],
        },
      },
    ],
  },
  {
    id: "basara-katana",
    name: t.weapons.basara.name,
    series: t.weapons.series.revenant,
    weaponType: "katana",
    attack: 3500,
    hp: 259,
    skills: [
      {
        id: "basara-supplemental",
        label: t.weapons.basara.skill1,
        description: t.weapons.basara.description1,
        effects: {
          supplemental: [
            {
              id: "basara-normal-supp",
              label: t.weapons.basara.skill1,
              amount: 50_000,
              appliesTo: ["normal", "counter"],
              cap: 100_000,
              condition: "always",
              sourceType: "weapon",
              boostable: true,
            },
          ],
          defenseIgnore: 0.02,
        },
      },
      {
        id: "basara-offense",
        label: t.weapons.basara.skill2,
        description: t.weapons.basara.description2,
        effects: {
          modifiers: [
            {
              id: "basara-normal-atk",
              label: t.demo.labels.normalAttack,
              bucket: "normal",
              value: 0.12,
              boostable: true,
            },
          ],
          multiattack: {
            double: 0.08,
            triple: 0.04,
          },
          bonusDamage: [
            {
              id: "basara-normal-bonus",
              label: t.demo.labels.bonusDamage,
              multiplier: 0.05,
              appliesTo: ["normal", "counter"],
              cap: 100_000,
              boostable: true,
            },
          ],
        },
      },
    ],
  },
];

function weaponById(id: string) {
  return WEAPON_CATALOG.find((weapon) => weapon.id === id);
}

function boostScalar(modifier: ScalarModifier, skillBoost: number): ScalarModifier {
  return modifier.boostable ? { ...modifier, value: modifier.value * (1 + skillBoost) } : modifier;
}

function boostCritical(rule: CriticalRule, skillBoost: number): CriticalRule {
  return rule.boostable
    ? { ...rule, chance: rule.chance * (1 + skillBoost), damage: rule.damage * (1 + skillBoost) }
    : rule;
}

function boostCap(rule: DamageCapModifier, skillBoost: number): DamageCapModifier {
  return rule.boostable ? { ...rule, value: rule.value * (1 + skillBoost) } : rule;
}

function boostSupplemental(rule: SupplementalRule, skillBoost: number): SupplementalRule {
  return rule.boostable ? { ...rule, amount: Math.round(rule.amount * (1 + skillBoost)) } : rule;
}

function boostBonus(rule: BonusDamageRule, skillBoost: number): BonusDamageRule {
  return rule.boostable ? { ...rule, multiplier: rule.multiplier * (1 + skillBoost) } : rule;
}

function collectEffects(weapons: WeaponDefinition[]) {
  return weapons.flatMap((weapon) => weapon.skills.map((skill) => skill.effects));
}

function sumSkillBoost(effects: WeaponSkillEffects[]) {
  return effects.reduce((total, effect) => total + (effect.skillBoost ?? 0), 0);
}

export function recomputeWeaponGrid(grid: WeaponGrid, partySize: number): WeaponGrid {
  const activeMainhandCount = Math.min(MAINHAND_SLOT_COUNT, Math.max(1, partySize));
  const activeEquips = [
    ...grid.mainhands.slice(0, activeMainhandCount),
    ...grid.subSlots,
  ].filter((slot): slot is EquippedWeapon => Boolean(slot));
  const activeWeapons = activeEquips
    .map((slot) => weaponById(slot.weaponId))
    .filter((weapon): weapon is WeaponDefinition => Boolean(weapon));
  const effects = collectEffects(activeWeapons);
  const skillBoost = sumSkillBoost(effects);
  const multiattack = effects.reduce<Partial<MultiattackProfile>>(
    (total, effect) => ({
      double: (total.double ?? 0) + (effect.multiattack?.double ?? 0),
      triple: (total.triple ?? 0) + (effect.multiattack?.triple ?? 0),
    }),
    {},
  );

  return {
    ...grid,
    activeMainhandCount,
    attack: activeWeapons.reduce((total, weapon) => total + weapon.attack, 0),
    hp: activeWeapons.reduce((total, weapon) => total + weapon.hp, 0),
    modifiers: effects.flatMap((effect) => effect.modifiers ?? []).map((modifier) => boostScalar(modifier, skillBoost)),
    critical: effects.flatMap((effect) => effect.critical ?? []).map((rule) => boostCritical(rule, skillBoost)),
    capUp: effects.flatMap((effect) => effect.capUp ?? []).map((rule) => boostCap(rule, skillBoost)),
    supplemental: effects
      .flatMap((effect) => effect.supplemental ?? [])
      .map((rule) => boostSupplemental(rule, skillBoost)),
    bonusDamage: effects.flatMap((effect) => effect.bonusDamage ?? []).map((rule) => boostBonus(rule, skillBoost)),
    multiattack,
    defenseIgnore: Math.min(
      0.3,
      effects.reduce((total, effect) => total + (effect.defenseIgnore ?? 0), 0) * (1 + skillBoost),
    ),
    skillBoost,
  };
}

export function createDemoWeaponGrid(partySize: number): WeaponGrid {
  return recomputeWeaponGrid(
    {
      name: t.demo.gridName,
      mainhands: [
        { weaponId: "luminous-blade" },
        { weaponId: "ephes-like" },
        { weaponId: "basara-katana" },
        null,
      ],
      subSlots: [
        { weaponId: "ephes-like" },
        { weaponId: "basara-katana" },
        { weaponId: "luminous-blade" },
        { weaponId: "ephes-like" },
        null,
        null,
        null,
        null,
        null,
      ],
      activeMainhandCount: partySize,
      attack: 0,
      hp: 0,
      modifiers: [],
      critical: [],
      capUp: [],
      supplemental: [],
      bonusDamage: [],
      multiattack: {},
      defenseIgnore: 0,
      skillBoost: 0,
    },
    partySize,
  );
}
