import weaponData from "../data/weapons.json";
import weaponGridData from "../data/weaponGrids.json";
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

export interface WeaponGridTemplate {
  id: string;
  name: string;
  mainhands: Array<EquippedWeapon | null>;
  subSlots: Array<EquippedWeapon | null>;
}

export const DEFAULT_WEAPON_CATALOG = weaponData as WeaponDefinition[];
export const DEFAULT_WEAPON_GRID_TEMPLATES = weaponGridData as WeaponGridTemplate[];

function weaponById(id: string, weaponCatalog: WeaponDefinition[]) {
  return weaponCatalog.find((weapon) => weapon.id === id);
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

export function recomputeWeaponGrid(
  grid: WeaponGrid,
  partySize: number,
  weaponCatalog: WeaponDefinition[] = DEFAULT_WEAPON_CATALOG,
): WeaponGrid {
  const activeMainhandCount = Math.min(MAINHAND_SLOT_COUNT, Math.max(1, partySize));
  const activeEquips = [
    ...grid.mainhands.slice(0, activeMainhandCount),
    ...grid.subSlots,
  ].filter((slot): slot is EquippedWeapon => Boolean(slot));
  const activeWeapons = activeEquips
    .map((slot) => weaponById(slot.weaponId, weaponCatalog))
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

export function createWeaponGridFromTemplate(
  template: WeaponGridTemplate,
  partySize: number,
  weaponCatalog: WeaponDefinition[] = DEFAULT_WEAPON_CATALOG,
): WeaponGrid {
  return recomputeWeaponGrid(
    {
      name: template.name,
      mainhands: template.mainhands,
      subSlots: template.subSlots,
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
    weaponCatalog,
  );
}

export function createDemoWeaponGrid(
  partySize: number,
  weaponCatalog: WeaponDefinition[] = DEFAULT_WEAPON_CATALOG,
  templates: WeaponGridTemplate[] = DEFAULT_WEAPON_GRID_TEMPLATES,
): WeaponGrid {
  return createWeaponGridFromTemplate(templates[0], partySize, weaponCatalog);
}
