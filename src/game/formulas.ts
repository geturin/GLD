import type {
  AttackKind,
  Combatant,
  CriticalRule,
  DamageBreakdown,
  DamageCapModifier,
  DamageCapTier,
  DamageContext,
  DamageInstance,
  Enemy,
  ModifierBucket,
  ScalarModifier,
  StatusEffect,
  SupplementalRule,
} from "./types";
import { t } from "../i18n/zhCN";

export const DEFAULT_ADVANTAGE_MULTIPLIER = 1.5;
const DEF_DOWN_CAP = 0.5;
const HARD_DAMAGE_CAP = 13_100_000;

const DAMAGE_CAP_TABLES: Record<AttackKind, DamageCapTier[]> = {
  normal: [
    { threshold: 300_000, reduction: 0 },
    { threshold: 400_000, reduction: 0.2 },
    { threshold: 500_000, reduction: 0.6 },
    { threshold: 600_000, reduction: 0.95 },
    { threshold: Infinity, reduction: 0.99 },
  ],
  counter: [
    { threshold: 300_000, reduction: 0 },
    { threshold: 400_000, reduction: 0.2 },
    { threshold: 500_000, reduction: 0.6 },
    { threshold: 600_000, reduction: 0.95 },
    { threshold: Infinity, reduction: 0.99 },
  ],
  charge: [
    { threshold: 1_500_000, reduction: 0 },
    { threshold: 1_700_000, reduction: 0.4 },
    { threshold: 1_800_000, reduction: 0.7 },
    { threshold: 2_500_000, reduction: 0.95 },
    { threshold: Infinity, reduction: 0.99 },
  ],
  skill: [
    { threshold: 200_000, reduction: 0 },
    { threshold: 260_000, reduction: 0.4 },
    { threshold: 330_000, reduction: 0.7 },
    { threshold: 500_000, reduction: 0.95 },
    { threshold: Infinity, reduction: 0.99 },
  ],
  chainBurst: [
    { threshold: 1_500_000, reduction: 0 },
    { threshold: 1_700_000, reduction: 0.4 },
    { threshold: 1_800_000, reduction: 0.7 },
    { threshold: 2_500_000, reduction: 0.95 },
    { threshold: Infinity, reduction: 0.99 },
  ],
};

const BUCKET_DEFAULTS: Record<ModifierBucket, number> = {
  normal: 0,
  omega: 0,
  ex: 0,
  advantage: 0,
  unique: 0,
  seraphic: 0,
  stamina: 0,
  enmity: 0,
  caDamage: 0,
  skillDamage: 0,
  amplified: 0,
};

export function collectStatusModifiers(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.modifiers ?? []);
}

export function collectStatusCapUp(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.capUp ?? []);
}

export function collectStatusSupplemental(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.supplemental ?? []);
}

export function collectDefenseDown(statusEffects: StatusEffect[] = []) {
  return Math.min(
    DEF_DOWN_CAP,
    statusEffects.reduce((total, effect) => total + (effect.defenseDown ?? 0), 0),
  );
}

export function collectDefenseUp(statusEffects: StatusEffect[] = []) {
  return statusEffects.reduce((total, effect) => total + (effect.defenseUp ?? 0), 0);
}

export function collectDamageCut(statusEffects: StatusEffect[] = []) {
  return Math.min(
    1,
    statusEffects.reduce((total, effect) => total + (effect.damageCut ?? 0), 0),
  );
}

export function collectDamageReduction(statusEffects: StatusEffect[] = []) {
  return Math.min(
    1,
    statusEffects.reduce((total, effect) => total + (effect.damageReduction ?? 0), 0),
  );
}

export function sumModifiers(modifiers: ScalarModifier[]) {
  return modifiers.reduce<Record<ModifierBucket, number>>(
    (totals, modifier) => {
      totals[modifier.bucket] += modifier.value;
      return totals;
    },
    { ...BUCKET_DEFAULTS },
  );
}

export function staminaStrength(maxStrength: number, hpRatio: number) {
  if (hpRatio < 0.25) {
    return 0;
  }

  return maxStrength * ((hpRatio - 0.25) / 0.75) ** 2.9;
}

export function enmityStrength(maxStrength: number, hpRatio: number) {
  const missingHpRatio = 1 - hpRatio;
  return maxStrength * ((1 + 2 * missingHpRatio) * missingHpRatio);
}

export function baseDamage(context: DamageContext) {
  const statusModifiers = collectStatusModifiers(context.attacker.statusEffects);
  const enemyDefenseDown = collectDefenseDown(context.enemy.statusEffects);
  const enemyDefenseUp = collectDefenseUp(context.enemy.statusEffects);
  const modifiers = sumModifiers([
    ...context.weaponGrid.modifiers,
    ...context.attacker.personalModifiers,
    ...statusModifiers,
    {
      id: "default-advantage",
      label: t.demo.labels.defaultAdvantage,
      bucket: "advantage",
      value: DEFAULT_ADVANTAGE_MULTIPLIER - 1,
    },
  ]);

  const hpRatio = Math.max(0, Math.min(1, context.attacker.hp / context.attacker.maxHp));
  const attack =
    context.attacker.baseAttack + context.weaponGrid.attack + context.enemy.defense * 24;
  const effectiveDefense = Math.max(
    1,
    context.enemy.defense * Math.max(0.1, 1 + enemyDefenseUp - enemyDefenseDown),
  );
  const normal = 1 + modifiers.normal;
  const omega = 1 + modifiers.omega;
  const ex = 1 + modifiers.ex;
  const advantage = 1 + modifiers.advantage;
  const unique = 1 + modifiers.unique;
  const seraphic = 1 + modifiers.seraphic;
  const amplified = 1 + modifiers.amplified;
  const typeBoost =
    context.kind === "charge"
      ? 1 + modifiers.caDamage
      : context.kind === "skill"
        ? 1 + modifiers.skillDamage
        : 1;

  return (
    (attack *
      normal *
      omega *
      ex *
      advantage *
      unique *
      (1 + staminaStrength(modifiers.stamina, hpRatio)) *
      (1 + enmityStrength(modifiers.enmity, hpRatio))) /
    effectiveDefense *
    context.hitMultiplier *
    seraphic *
    amplified *
    typeBoost
  );
}

export function capValue(baseCap: number, capUps: DamageCapModifier[], kind: AttackKind) {
  const weaponCap = Math.min(
    0.2,
    capUps
      .filter((cap) => cap.source === "weapon" && cap.appliesTo.includes(kind))
      .reduce((sum, cap) => sum + cap.value, 0),
  );
  const otherCap = capUps
    .filter((cap) => cap.source !== "weapon" && cap.appliesTo.includes(kind))
    .reduce((sum, cap) => sum + cap.value, 0);

  return baseCap * (1 + weaponCap + otherCap);
}

export function applyDamageCapTable(damage: number, kind: AttackKind, capMultiplier: number) {
  const table = DAMAGE_CAP_TABLES[kind];
  let previousThreshold = 0;
  let total = 0;

  for (const tier of table) {
    const threshold = tier.threshold * capMultiplier;
    const tierInput = Math.min(Math.max(damage - previousThreshold, 0), threshold - previousThreshold);
    total += tierInput * (1 - tier.reduction);
    previousThreshold = threshold;

    if (damage <= threshold) {
      break;
    }
  }

  return Math.min(total, HARD_DAMAGE_CAP);
}

export function randomVarianceMultiplier(seed: number, enabled = true) {
  if (!enabled) {
    return 1;
  }

  return 0.95 + Math.round(deterministicRoll(seed, "variance") * 10) / 100;
}

export function deterministicRoll(seed: number, salt: string) {
  let hash = seed;
  for (const char of salt) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return (hash % 1000) / 1000;
}

export function criticalMultiplier(criticalRules: CriticalRule[], seed: number) {
  return criticalRules.reduce((multiplier, rule) => {
    const roll = deterministicRoll(seed, rule.id);
    return roll < rule.chance ? multiplier + rule.damage : multiplier;
  }, 1);
}

export function supplementalDamage(
  rules: SupplementalRule[],
  kind: AttackKind,
  hitCount: number,
  criticalTriggered: boolean,
) {
  return rules
    .filter((rule) => rule.appliesTo.includes(kind))
    .filter((rule) => rule.condition !== "critical" || criticalTriggered)
    .reduce((total, rule) => total + Math.min(rule.amount, rule.cap ?? rule.amount) * hitCount, 0);
}

export function resolveHit(context: DamageContext, hitCount = 1): DamageBreakdown {
  const capUps = [
    ...context.weaponGrid.capUp,
    ...context.attacker.capUp,
    ...collectStatusCapUp(context.attacker.statusEffects),
  ];
  const supplementals = [
    ...context.weaponGrid.supplemental,
    ...context.attacker.supplemental,
    ...collectStatusSupplemental(context.attacker.statusEffects),
  ];
  const criticalRules = [...context.weaponGrid.critical, ...context.attacker.critical];
  const cap = capValue(context.cap, capUps, context.kind);
  const rawBase = baseDamage(context);
  const variance = randomVarianceMultiplier(context.criticalSeed, context.randomVariance);
  const crit = criticalMultiplier(criticalRules, context.criticalSeed);
  const preCap = rawBase * variance * crit;
  const capped = applyDamageCapTable(preCap, context.kind, cap / context.cap);
  const primaryDamage = capped * hitCount;
  const supplemental = supplementalDamage(supplementals, context.kind, hitCount, crit > 1);
  const bonusInstances: DamageInstance[] = context.attacker.bonusDamage
    .filter((bonusRule) => !bonusRule.appliesTo || bonusRule.appliesTo.includes(context.kind))
    .map((bonusRule) => {
      const rawBonus = capped * bonusRule.multiplier;
      return {
        id: bonusRule.id,
        label: bonusRule.label,
        kind: "bonus",
        damage: Math.round(Math.min(rawBonus, bonusRule.cap ?? rawBonus) * hitCount),
      };
    });
  const supplementalInstance: DamageInstance = {
    id: "supplemental-total",
    label: t.preview.supplemental,
    kind: "supplemental",
    damage: Math.round(supplemental),
  };
  const instances: DamageInstance[] = [
    {
      id: "primary",
      label: context.kind,
      kind: "primary",
      damage: Math.round(primaryDamage),
    },
    ...bonusInstances,
    ...(supplemental > 0 ? [supplementalInstance] : []),
  ];
  const bonus = bonusInstances.reduce((total, instance) => total + instance.damage, 0);
  const damageCut = collectDamageCut(context.enemy.statusEffects);
  const damageReduction = collectDamageReduction(context.enemy.statusEffects);
  const finalBeforeReduction = instances.reduce((total, instance) => total + instance.damage, 0);
  const finalDamage = finalBeforeReduction * (1 - damageCut) * (1 - damageReduction);

  return {
    baseDamage: Math.round(rawBase),
    preCapDamage: Math.round(preCap),
    cappedDamage: Math.round(capped),
    finalDamage: Math.round(finalDamage),
    supplementalDamage: Math.round(supplemental),
    bonusDamage: Math.round(bonus),
    criticalMultiplier: Number(crit.toFixed(2)),
    varianceMultiplier: Number(variance.toFixed(2)),
    cap: Math.round(cap),
    hitCount,
    instances,
    notes: [
      t.battle.capNote.replace("{value}", Math.round(cap).toLocaleString()),
      crit > 1
        ? t.battle.critical.replace("{value}", crit.toFixed(2))
        : t.battle.noCritical,
      `随机 x${variance.toFixed(2)}`,
    ],
  };
}

export function normalHitCount(attacker: Combatant, seed: number) {
  const statusMa = attacker.statusEffects.reduce(
    (profile, effect) => ({
      double: profile.double + (effect.multiattack?.double ?? 0),
      triple: profile.triple + (effect.multiattack?.triple ?? 0),
    }),
    { double: attacker.multiattack.double, triple: attacker.multiattack.triple },
  );
  const roll = deterministicRoll(seed, `${attacker.id}-ma`);

  if (roll < Math.min(0.95, statusMa.triple)) {
    return 3;
  }

  if (roll < Math.min(0.95, statusMa.triple + statusMa.double)) {
    return 2;
  }

  return 1;
}

export function enemyModeAfterDamage(enemy: Enemy, damage: number): Enemy["mode"] {
  const nextGauge = Math.max(0, enemy.modeGauge - damage / enemy.maxHp);
  if (nextGauge <= 0.18) {
    return "break";
  }

  if (enemy.hp / enemy.maxHp <= 0.55) {
    return "overdrive";
  }

  return "normal";
}
