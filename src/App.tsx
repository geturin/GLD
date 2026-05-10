import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Axe,
  Flame,
  Gem,
  Map,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";
import { attackTurn, executeSkill } from "./game/battleEngine";
import { createInitialBattleState } from "./game/demoState";
import { DEFAULT_ADVANTAGE_MULTIPLIER, resolveHit } from "./game/formulas";
import { describeSkill } from "./game/skillText";
import type {
  AttackKind,
  BattleState,
  Combatant,
  ModifierBucket,
  StatusEffect,
} from "./game/types";
import { t } from "./i18n/zhCN";

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function hpPercent(current: number, max: number) {
  return `${Math.max(0, Math.min(100, (current / max) * 100))}%`;
}

function expectedNormalDamage(state: BattleState, member: Combatant) {
  return resolveHit({
    attacker: member,
    enemy: state.enemy,
    weaponGrid: state.weaponGrid,
    kind: "normal",
    hitMultiplier: 1,
    cap: 440000,
    criticalSeed: state.turn * 31,
    randomVariance: state.options.randomVariance,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentValue(value: number) {
  return Math.round(value * 100);
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function statusDetails(effect: StatusEffect) {
  const details = [
    ...(effect.attackDown
      ? [formatTemplate(t.status.attackDown, { value: `${percentValue(effect.attackDown)}%` })]
      : []),
    ...(effect.defenseDown
      ? [formatTemplate(t.status.defenseDown, { value: `${percentValue(effect.defenseDown)}%` })]
      : []),
    ...(effect.defenseUp
      ? [formatTemplate(t.status.defenseUp, { value: `${percentValue(effect.defenseUp)}%` })]
      : []),
    ...(effect.damageCut
      ? [formatTemplate(t.status.damageCut, { value: `${percentValue(effect.damageCut)}%` })]
      : []),
    ...(effect.damageReduction
      ? [formatTemplate(t.status.damageReduction, { value: `${percentValue(effect.damageReduction)}%` })]
      : []),
    ...(effect.modifiers ?? []).map((modifier) =>
      formatTemplate(t.status.modifier, {
        label: modifier.label,
        value: `${percentValue(modifier.value)}%`,
      }),
    ),
    ...(effect.capUp ?? []).map((cap) =>
      formatTemplate(t.status.capUp, {
        label: cap.label,
        value: `${percentValue(cap.value)}%`,
      }),
    ),
    ...(effect.supplemental ?? []).map((rule) =>
      formatTemplate(t.status.supplemental, {
        label: rule.label,
        value: formatNumber(rule.amount),
      }),
    ),
    ...(effect.multiattack?.double
      ? [
          formatTemplate(t.status.multiattackDouble, {
            value: `${percentValue(effect.multiattack.double)}%`,
          }),
        ]
      : []),
    ...(effect.multiattack?.triple
      ? [
          formatTemplate(t.status.multiattackTriple, {
            value: `${percentValue(effect.multiattack.triple)}%`,
          }),
        ]
      : []),
  ];

  return details.join(" / ");
}

function statusTone(effect: StatusEffect) {
  const hasDebuff = Boolean(effect.attackDown || effect.defenseDown);
  const hasBuff = Boolean(
    effect.modifiers?.length ||
      effect.capUp?.length ||
      effect.supplemental?.length ||
      effect.multiattack?.double ||
      effect.multiattack?.triple ||
      effect.defenseUp ||
      effect.damageCut ||
      effect.damageReduction,
  );

  if (hasBuff && hasDebuff) {
    return "mixed";
  }

  return hasDebuff ? "debuff" : "buff";
}

function StatusList({
  effects,
  emptyText,
  title,
}: {
  effects: StatusEffect[];
  emptyText: string;
  title: string;
}) {
  return (
    <section className="status-panel">
      <h3>{title}</h3>
      {effects.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {effects.map((effect) => (
            <li className={statusTone(effect)} key={`${effect.id}-${effect.duration}`}>
              <span>
                <strong>{effect.label}</strong>
                <span className="status-meta">
                  <b>{t.status[statusTone(effect)]}</b>
                  <em>
                    {formatTemplate(t.battle.remainingTurns, {
                      turns: effect.duration,
                    })}
                  </em>
                </span>
              </span>
              <small>{statusDetails(effect)}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FieldGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="tuning-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function NumberControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max?: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(readNumber(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function RangeControl({
  label,
  max,
  min = 0,
  onChange,
  step = 1,
  suffix = "%",
  value,
}: {
  label: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="range-control">
      <span>
        {label} <strong>{suffix === "" ? formatNumber(value) : `${value}${suffix}`}</strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(readNumber(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

export function App() {
  const [battle, setBattle] = useState(createInitialBattleState);
  const [selectedMemberId, setSelectedMemberId] = useState(battle.party[0].id);

  const selectedMember =
    battle.party.find((member) => member.id === selectedMemberId) ?? battle.party[0];
  const selectedPreview = useMemo(
    () => expectedNormalDamage(battle, selectedMember),
    [battle, selectedMember],
  );
  const enemyHpRate = hpPercent(battle.enemy.hp, battle.enemy.maxHp);

  function updateSelectedMember(updater: (member: Combatant) => Combatant) {
    setBattle((current) => ({
      ...current,
      party: current.party.map((member) =>
        member.id === selectedMember.id ? updater(member) : member,
      ),
      lastActionSummary: `${selectedMember.name}${t.battle.statsAdjusted}`,
    }));
  }

  function setSelectedBaseAttack(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      baseAttack: clamp(Math.round(value), 1, 999999),
    }));
  }

  function setSelectedMaxHp(value: number) {
    updateSelectedMember((member) => {
      const maxHp = clamp(Math.round(value), 1, 999999);
      return {
        ...member,
        maxHp,
        hp: clamp(member.hp, 0, maxHp),
      };
    });
  }

  function setSelectedHp(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      hp: clamp(Math.round(value), 0, member.maxHp),
    }));
  }

  function setSelectedChargeBar(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      chargeBar: clamp(Math.round(value), 0, 100),
    }));
  }

  function setSelectedMultiattack(kind: "double" | "triple", value: number) {
    updateSelectedMember((member) => ({
      ...member,
      multiattack: {
        ...member.multiattack,
        [kind]: clamp(value / 100, 0, 1),
      },
    }));
  }

  function updateGridModifier(id: string, bucket: ModifierBucket, value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        modifiers: current.weaponGrid.modifiers.map((modifier) =>
          modifier.id === id ? { ...modifier, bucket, value: value / 100 } : modifier,
        ),
      },
      lastActionSummary: t.battle.weaponSkillAdjusted,
    }));
  }

  function updatePersonalModifier(id: string, bucket: ModifierBucket, value: number) {
    updateSelectedMember((member) => ({
      ...member,
      personalModifiers: member.personalModifiers.map((modifier) =>
        modifier.id === id ? { ...modifier, bucket, value: value / 100 } : modifier,
      ),
    }));
  }

  function updateWeaponCap(id: string, appliesTo: AttackKind[], value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        capUp: current.weaponGrid.capUp.map((cap) =>
          cap.id === id ? { ...cap, appliesTo, value: value / 100 } : cap,
        ),
      },
      lastActionSummary: t.battle.capAdjusted,
    }));
  }

  function updateSupplemental(id: string, appliesTo: AttackKind[], value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        supplemental: current.weaponGrid.supplemental.map((rule) =>
          rule.id === id ? { ...rule, appliesTo, amount: Math.round(value) } : rule,
        ),
      },
      lastActionSummary: t.battle.supplementalAdjusted,
    }));
  }

  function updateCritical(field: "chance" | "damage", value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        critical: current.weaponGrid.critical.map((rule) =>
          rule.id === "demo-crit" ? { ...rule, [field]: value / 100 } : rule,
        ),
      },
      lastActionSummary: t.battle.criticalAdjusted,
    }));
  }

  function updateBonusDamage(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      bonusDamage: member.bonusDamage.map((rule) =>
        rule.id === "normal-echo" ? { ...rule, multiplier: value / 100 } : rule,
      ),
    }));
  }

  const gridModifier = (id: string) =>
    percentValue(battle.weaponGrid.modifiers.find((modifier) => modifier.id === id)?.value ?? 0);
  const personalModifier = (id: string) =>
    percentValue(selectedMember.personalModifiers.find((modifier) => modifier.id === id)?.value ?? 0);
  const capModifier = (id: string) =>
    percentValue(battle.weaponGrid.capUp.find((cap) => cap.id === id)?.value ?? 0);
  const supplemental = (id: string) =>
    battle.weaponGrid.supplemental.find((rule) => rule.id === id)?.amount ?? 0;
  const critical = battle.weaponGrid.critical.find((rule) => rule.id === "demo-crit");
  const bonusDamage = percentValue(
    selectedMember.bonusDamage.find((rule) => rule.id === "normal-echo")?.multiplier ?? 0,
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.app.eyebrow}</p>
          <h1>{t.app.title}</h1>
        </div>
        <nav className="mode-tabs" aria-label="游戏模式">
          <button type="button">
            <Map size={18} />
            {t.nav.dungeon}
          </button>
          <button className="active" type="button">
            <Swords size={18} />
            {t.nav.battle}
          </button>
          <button type="button">
            <Gem size={18} />
            {t.nav.grid}
          </button>
        </nav>
      </header>

      <section className="combat-layout" aria-label="GBF-like 战斗原型">
        <aside className="panel party-panel">
          <div className="panel-heading">
            <Shield size={18} />
            <h2>{t.panels.party}</h2>
          </div>
          <div className="party-list">
            {battle.party.map((member) => (
              <button
                className={`party-card selectable ${member.id === selectedMember.id ? "selected" : ""}`}
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                type="button"
              >
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
                <span className="charge-pill">{member.chargeBar}% CA</span>
                <span className="bar">
                  <i style={{ width: hpPercent(member.hp, member.maxHp) }} />
                </span>
                <span className="stat-row">
                  <small>{t.battle.hp} {formatNumber(member.hp)}</small>
                  <small>{t.battle.advantage}</small>
                </span>
              </button>
            ))}
          </div>

          <StatusList
            effects={selectedMember.statusEffects}
            emptyText={t.battle.noStatusEffects}
            title={t.panels.statusEffects}
          />

          <section className="stat-dashboard" aria-label={`${selectedMember.name}${t.panels.damageLab}`}>
            <div className="section-title compact-title">
              <Activity size={18} />
              <h2>{t.panels.damageLab}</h2>
            </div>

            <FieldGroup title={t.groups.base}>
              <NumberControl label={t.controls.characterAttack} min={1} onChange={setSelectedBaseAttack} step={100} value={selectedMember.baseAttack} />
              <NumberControl label={t.controls.gridAttack} min={0} onChange={(value) => setBattle((current) => ({
                ...current,
                weaponGrid: { ...current.weaponGrid, attack: clamp(Math.round(value), 0, 999999) },
                lastActionSummary: t.battle.gridAttackAdjusted,
              }))} step={100} value={battle.weaponGrid.attack} />
              <NumberControl label={t.controls.maxHp} min={1} onChange={setSelectedMaxHp} step={100} value={selectedMember.maxHp} />
              <RangeControl label={t.controls.currentHp} max={selectedMember.maxHp} onChange={setSelectedHp} step={100} suffix="" value={selectedMember.hp} />
              <RangeControl label={t.controls.chargeBar} max={100} onChange={setSelectedChargeBar} step={5} value={selectedMember.chargeBar} />
              <RangeControl label={t.controls.doubleAttack} max={100} onChange={(value) => setSelectedMultiattack("double", value)} value={Math.round(selectedMember.multiattack.double * 100)} />
              <RangeControl label={t.controls.tripleAttack} max={100} onChange={(value) => setSelectedMultiattack("triple", value)} value={Math.round(selectedMember.multiattack.triple * 100)} />
              <label className="toggle-control">
                <span>{t.controls.randomVariance}</span>
                <input
                  checked={battle.options.randomVariance}
                  onChange={(event) =>
                    setBattle((current) => ({
                      ...current,
                      options: { ...current.options, randomVariance: event.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
            </FieldGroup>

            <FieldGroup title={t.groups.attackBuckets}>
              <RangeControl label={t.controls.normalAttack} max={500} onChange={(value) => updateGridModifier("normal-atk", "normal", value)} value={gridModifier("normal-atk")} />
              <RangeControl label={t.controls.omegaAttack} max={500} onChange={(value) => updateGridModifier("omega-atk", "omega", value)} value={gridModifier("omega-atk")} />
              <RangeControl label={t.controls.exAttack} max={300} onChange={(value) => updateGridModifier("ex-atk", "ex", value)} value={gridModifier("ex-atk")} />
              <RangeControl label={t.controls.uniqueAttack} max={200} onChange={(value) => updatePersonalModifier("unique-passive", "unique", value)} value={personalModifier("unique-passive")} />
              <RangeControl label={t.controls.seraphic} max={30} onChange={(value) => updatePersonalModifier("seraphic-passive", "seraphic", value)} value={personalModifier("seraphic-passive")} />
              <RangeControl label={t.controls.damageAmplified} max={50} onChange={(value) => updateGridModifier("amplified-dmg", "amplified", value)} value={gridModifier("amplified-dmg")} />
            </FieldGroup>

            <FieldGroup title={t.groups.hpConditional}>
              <RangeControl label={t.controls.stamina} max={100} onChange={(value) => updateGridModifier("stamina-atk", "stamina", value)} value={gridModifier("stamina-atk")} />
              <RangeControl label={t.controls.enmity} max={100} onChange={(value) => updateGridModifier("enmity-atk", "enmity", value)} value={gridModifier("enmity-atk")} />
            </FieldGroup>

            <FieldGroup title={t.groups.damageType}>
              <RangeControl label={t.controls.skillDamage} max={300} onChange={(value) => updateGridModifier("skill-dmg", "skillDamage", value)} value={gridModifier("skill-dmg")} />
              <RangeControl label={t.controls.chargeAttackDamage} max={300} onChange={(value) => updateGridModifier("ca-dmg", "caDamage", value)} value={gridModifier("ca-dmg")} />
              <RangeControl label={t.controls.bonusDamage} max={100} onChange={updateBonusDamage} value={bonusDamage} />
            </FieldGroup>

            <FieldGroup title={t.groups.damageCap}>
              <RangeControl label={t.controls.normalCap} max={20} onChange={(value) => updateWeaponCap("normal-cap-up", ["normal", "counter"], value)} value={capModifier("normal-cap-up")} />
              <RangeControl label={t.controls.skillCap} max={20} onChange={(value) => updateWeaponCap("skill-cap-up", ["skill"], value)} value={capModifier("skill-cap-up")} />
              <RangeControl label={t.controls.chargeAttackCap} max={20} onChange={(value) => updateWeaponCap("ca-cap-up", ["charge"], value)} value={capModifier("ca-cap-up")} />
            </FieldGroup>

            <FieldGroup title={t.groups.criticalSupplemental}>
              <RangeControl label={t.controls.criticalRate} max={100} onChange={(value) => updateCritical("chance", value)} value={percentValue(critical?.chance ?? 0)} />
              <RangeControl label={t.controls.criticalDamage} max={200} onChange={(value) => updateCritical("damage", value)} value={percentValue(critical?.damage ?? 0)} />
              <NumberControl label={t.controls.normalSupplemental} min={0} onChange={(value) => updateSupplemental("normal-supp", ["normal", "counter"], value)} step={10000} value={supplemental("normal-supp")} />
              <NumberControl label={t.controls.skillSupplemental} min={0} onChange={(value) => updateSupplemental("skill-supp", ["skill"], value)} step={10000} value={supplemental("skill-supp")} />
              <NumberControl label={t.controls.chargeAttackSupplemental} min={0} onChange={(value) => updateSupplemental("ca-supp", ["charge"], value)} step={10000} value={supplemental("ca-supp")} />
            </FieldGroup>
          </section>
        </aside>

        <section className="battle-stage" aria-label="战斗舞台">
          <div className="stage-header">
            <div>
              <p className="eyebrow">{t.battle.turn} {battle.turn}</p>
              <h2>{battle.enemy.name}</h2>
            </div>
            <div className={`mode-badge ${battle.enemy.mode}`}>
              <Activity size={18} />
              {battle.enemy.mode}
            </div>
          </div>

          <section className="enemy-board" aria-label="敌人状态">
            <div className="enemy-core">
              <div className="enemy-sigil">
                <Flame size={54} />
              </div>
              <div>
                <h3>{battle.enemy.name}</h3>
                <p>
                  {t.battle.foe} / {t.battle.defense} {battle.enemy.defense} / {t.battle.chargeDiamond} {battle.enemy.chargeDiamonds}/
                  {battle.enemy.maxChargeDiamonds}
                </p>
              </div>
            </div>
            <div className="large-hp">
              <span>{formatNumber(battle.enemy.hp)} {t.battle.hp}</span>
              <i style={{ width: enemyHpRate }} />
            </div>
            <StatusList
              effects={battle.enemy.statusEffects}
              emptyText={t.battle.noStatusEffects}
              title={t.panels.statusEffects}
            />
          </section>

          <section className="command-deck" aria-label="战斗指令">
            <button className="primary-command" onClick={() => setBattle(attackTurn)} type="button">
              <Swords size={20} />
              {t.commands.attackTurn}
            </button>
            <button onClick={() => setBattle(createInitialBattleState())} type="button">
              <RotateCcw size={18} />
              {t.commands.reset}
            </button>
          </section>

          <section className="skill-grid" aria-label={`${selectedMember.name}${t.panels.skills}`}>
            <div className="section-title">
              <Zap size={18} />
              <h2>{selectedMember.name}{t.panels.skills}</h2>
            </div>
            {selectedMember.skills.map((skill) => (
              <button
                disabled={skill.remainingCooldown > 0}
                key={skill.id}
                onClick={() =>
                  setBattle((current) => executeSkill(current, selectedMember.id, skill.id))
                }
                type="button"
              >
                <span className="skill-copy">
                  <strong>{skill.label}</strong>
                  <small>{describeSkill(skill)}</small>
                </span>
                <em>{skill.remainingCooldown > 0 ? `${skill.remainingCooldown}T` : skill.kind}</em>
              </button>
            ))}
          </section>

          <section className="battle-strip" aria-label="伤害预览">
            <div>
              <Axe size={18} />
              {t.preview.base} {formatNumber(selectedPreview.baseDamage)}
            </div>
            <div>
              <Flame size={18} />
              {t.preview.advantage} x{DEFAULT_ADVANTAGE_MULTIPLIER}
            </div>
            <div>
              <Sparkles size={18} />
              {t.preview.cap} {formatNumber(selectedPreview.cap)}
            </div>
            <div>
              <Zap size={18} />
              {t.preview.hit} {formatNumber(selectedPreview.finalDamage)}
            </div>
            <div>
              <Sparkles size={18} />
              {t.preview.crit} x{selectedPreview.criticalMultiplier}
            </div>
            <div>
              <Sparkles size={18} />
              随机 x{selectedPreview.varianceMultiplier}
            </div>
            <div>
              <Axe size={18} />
              {t.preview.supplemental} {formatNumber(selectedPreview.supplementalDamage)}
            </div>
          </section>
        </section>

        <aside className="panel systems-panel">
          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>{t.panels.systems}</h2>
          </div>
          <ul className="system-list compact">
            {t.systems.map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
          <div className="formula-card">
            <h3>{t.formula.title}</h3>
            <p>{t.formula.description}</p>
          </div>
        </aside>
      </section>

      <section className="log-dock" aria-label={t.panels.battleLog}>
        <div className="section-title">
          <Activity size={18} />
          <h2>{battle.lastActionSummary}</h2>
        </div>
        <ol>
          {battle.log
            .slice()
            .reverse()
            .slice(0, 10)
            .map((entry) => (
              <li key={entry.id}>
                <span>{t.battle.turn}{entry.turn}</span>
                <strong>{entry.actor}</strong>
                <em>{entry.action}</em>
                <p>{entry.detail}</p>
              </li>
            ))}
        </ol>
      </section>
    </main>
  );
}
