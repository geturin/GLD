import type { SkillDefinition } from "./types";
import { t } from "../i18n/zhCN";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function turns(value: number) {
  return `${value}T`;
}

function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function firstEffect(skill: SkillDefinition) {
  return skill.applies?.[0];
}

export function describeSkill(skill: SkillDefinition) {
  const effect = firstEffect(skill);

  if (skill.kind === "damage") {
    return format(t.skillText.damage, {
      cap: (skill.damageCap ?? 0).toLocaleString(),
      cooldown: turns(skill.cooldown),
      hits: skill.hitCount ?? 1,
      multiplier: percent(skill.damageMultiplier ?? 1),
    });
  }

  if (skill.kind === "buff" && skill.target === "party") {
    const attackUp =
      effect?.modifiers?.find((modifier) => modifier.bucket === "normal")?.value ?? 0;
    return format(t.skillText.partyBuff, {
      attackUp: percent(attackUp),
      cooldown: turns(skill.cooldown),
      duration: turns(effect?.duration ?? 0),
    });
  }

  if (skill.kind === "buff" && skill.target === "self") {
    const uniqueUp =
      effect?.modifiers?.find((modifier) => modifier.bucket === "unique")?.value ?? 0;
    return format(t.skillText.selfUnique, {
      cooldown: turns(skill.cooldown),
      duration: turns(effect?.duration ?? 0),
      uniqueUp: percent(uniqueUp),
    });
  }

  if (skill.kind === "debuff") {
    return format(t.skillText.debuff, {
      attackDown: percent(effect?.attackDown ?? 0),
      cooldown: turns(skill.cooldown),
      defenseDown: percent(effect?.defenseDown ?? 0),
      duration: turns(effect?.duration ?? 0),
    });
  }

  return format(t.skillText.fallback, { cooldown: turns(skill.cooldown) });
}
