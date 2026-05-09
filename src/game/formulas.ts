import type {
  AttackKind,
  Combatant,
  CriticalRule,
  DamageBreakdown,
  DamageCapModifier,
  DamageContext,
  Element,
  Enemy,
  ModifierBucket,
  ScalarModifier,
  StatusEffect,
  SupplementalRule,
} from "./types";

const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  fire: "wind",
  water: "fire",
  earth: "water",
  wind: "earth",
  light: "dark",
  dark: "light",
};

const BUCKET_DEFAULTS: Record<ModifierBucket, number> = {
  normal: 0,
  omega: 0,
  ex: 0,
  elemental: 0,
  unique: 0,
  seraphic: 0,
  stamina: 0,
  enmity: 0,
  caDamage: 0,
  skillDamage: 0,
  amplified: 0,
};

export function elementMultiplier(attacker: Element, defender: Element) {
  if (ELEMENT_ADVANTAGE[attacker] === defender) {
    return 1.5;
  }

  if (ELEMENT_ADVANTAGE[defender] === attacker) {
    return 0.75;
  }

  return 1;
}

export function collectStatusModifiers(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.modifiers ?? []);
}

export function collectStatusCapUp(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.capUp ?? []);
}

export function collectStatusSupplemental(statusEffects: StatusEffect[] = []) {
  return statusEffects.flatMap((effect) => effect.supplemental ?? []);
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

export function hpCurveModifiers(attacker: Combatant) {
  const hpRatio = Math.max(0, Math.min(1, attacker.hp / attacker.maxHp));
  return {
    stamina: 1 + Math.max(0, hpRatio - 0.25) * 0.36,
    enmity: 1 + Math.max(0, 1 - hpRatio) ** 1.7 * 0.72,
  };
}

export function baseDamage(context: DamageContext) {
  const statusModifiers = collectStatusModifiers(context.attacker.statusEffects);
  const enemyDefenseDown = context.enemy.statusEffects.reduce(
    (total, effect) => total + (effect.defenseDown ?? 0),
    0,
  );
  const modifiers = sumModifiers([
    ...context.weaponGrid.modifiers,
    ...context.attacker.personalModifiers,
    ...statusModifiers,
    {
      id: "element-matchup",
      label: "Element matchup",
      bucket: "elemental",
      value: elementMultiplier(context.attacker.element, context.enemy.element) - 1,
    },
  ]);

  const hpCurves = hpCurveModifiers(context.attacker);
  const hpRatio = Math.max(0, Math.min(1, context.attacker.hp / context.attacker.maxHp));
  const attack =
    context.attacker.baseAttack + context.weaponGrid.attack + context.enemy.defense * 24;
  const effectiveDefense = Math.max(1, context.enemy.defense * (1 - enemyDefenseDown));
  const normal = 1 + modifiers.normal;
  const omega = 1 + modifiers.omega;
  const ex = 1 + modifiers.ex;
  const elemental = 1 + modifiers.elemental;
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
      elemental *
      unique *
      hpCurves.stamina *
      (1 + modifiers.stamina * hpRatio) *
      hpCurves.enmity *
      (1 + modifiers.enmity * (1 - hpRatio))) /
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

export function applySoftCap(damage: number, cap: number) {
  if (damage <= cap) {
    return damage;
  }

  const overflow = damage - cap;
  const tierOne = Math.min(overflow, cap * 0.5) * 0.5;
  const tierTwo = Math.min(Math.max(overflow - cap * 0.5, 0), cap) * 0.2;
  const tierThree = Math.max(overflow - cap * 1.5, 0) * 0.05;
  return cap + tierOne + tierTwo + tierThree;
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
) {
  return rules
    .filter((rule) => rule.appliesTo.includes(kind))
    .reduce((total, rule) => total + rule.amount * hitCount, 0);
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
  const crit = criticalMultiplier(criticalRules, context.criticalSeed);
  const preCap = rawBase * crit;
  const capped = applySoftCap(preCap, cap);
  const supplemental = supplementalDamage(supplementals, context.kind, hitCount);
  const bonus = context.attacker.bonusDamage.reduce((total, bonusRule) => {
    return total + capped * hitCount * bonusRule.multiplier;
  }, 0);

  return {
    baseDamage: Math.round(rawBase),
    preCapDamage: Math.round(preCap),
    cappedDamage: Math.round(capped),
    finalDamage: Math.round(capped * hitCount + supplemental + bonus),
    supplementalDamage: Math.round(supplemental),
    bonusDamage: Math.round(bonus),
    criticalMultiplier: Number(crit.toFixed(2)),
    cap: Math.round(cap),
    hitCount,
    notes: [
      `cap ${Math.round(cap).toLocaleString()}`,
      crit > 1 ? `critical x${crit.toFixed(2)}` : "no critical",
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
