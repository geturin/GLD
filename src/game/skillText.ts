import type { SkillDefinition } from "./types";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function turns(value: number) {
  return `${value}T`;
}

function firstEffect(skill: SkillDefinition) {
  return skill.applies?.[0];
}

export function describeSkill(skill: SkillDefinition) {
  const effect = firstEffect(skill);

  if (skill.kind === "damage") {
    return [
      `${skill.hitCount ?? 1}-hit ${percent(skill.damageMultiplier ?? 1)} skill damage to one foe.`,
      `Damage cap: ~${(skill.damageCap ?? 0).toLocaleString()} per hit.`,
      `Cooldown: ${turns(skill.cooldown)}.`,
    ].join(" ");
  }

  if (skill.kind === "buff" && skill.target === "party") {
    const attackUp =
      effect?.modifiers?.find((modifier) => modifier.bucket === "normal")?.value ?? 0;
    return [
      `All allies gain ${percent(attackUp)} ATK Up.`,
      `Duration: ${turns(effect?.duration ?? 0)}.`,
      `Cooldown: ${turns(skill.cooldown)}.`,
    ].join(" ");
  }

  if (skill.kind === "buff" && skill.target === "self") {
    const uniqueUp =
      effect?.modifiers?.find((modifier) => modifier.bucket === "unique")?.value ?? 0;
    return [
      `Caster gains ${percent(uniqueUp)} Unique ATK Up in the independent damage bucket.`,
      `Duration: ${turns(effect?.duration ?? 0)}.`,
      `Cooldown: ${turns(skill.cooldown)}.`,
    ].join(" ");
  }

  if (skill.kind === "debuff") {
    return [
      `Inflict ${percent(effect?.attackDown ?? 0)} ATK Down and ${percent(effect?.defenseDown ?? 0)} DEF Down on one foe.`,
      `Duration: ${turns(effect?.duration ?? 0)}.`,
      `Cooldown: ${turns(skill.cooldown)}.`,
    ].join(" ");
  }

  return `Cooldown: ${turns(skill.cooldown)}.`;
}
