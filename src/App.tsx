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
import type { AttackKind, BattleState, Combatant, ModifierBucket } from "./game/types";

const coveredSystems = [
  "Damage formula",
  "Damage cap / cap up",
  "Multiattack",
  "Critical",
  "Bonus and supplemental damage",
  "Charge attack",
  "Chain burst",
  "Charge bar",
  "Weapon grid",
  "Default advantage matchup",
  "Buffs and debuffs",
  "Defense",
  "Overdrive / break",
  "Turn and action order",
  "Class / character passives",
  "Stamina / enmity hooks",
  "Skill damage",
  "Counters / substitute",
  "Dispel / delay hooks",
];

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
      lastActionSummary: `${selectedMember.name} stats adjusted`,
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
      lastActionSummary: "Weapon skill values adjusted",
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
      lastActionSummary: "Damage cap values adjusted",
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
      lastActionSummary: "Supplemental damage adjusted",
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
      lastActionSummary: "Critical values adjusted",
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
          <p className="eyebrow">Single-character GBF-like battle demo</p>
          <h1>GLD Combat Lab</h1>
        </div>
        <nav className="mode-tabs" aria-label="Game work modes">
          <button type="button">
            <Map size={18} />
            Dungeon
          </button>
          <button className="active" type="button">
            <Swords size={18} />
            Battle
          </button>
          <button type="button">
            <Gem size={18} />
            Grid
          </button>
        </nav>
      </header>

      <section className="combat-layout" aria-label="GBF-like combat prototype">
        <aside className="panel party-panel">
          <div className="panel-heading">
            <Shield size={18} />
            <h2>Party</h2>
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
                  <small>HP {formatNumber(member.hp)}</small>
                  <small>Advantage</small>
                </span>
              </button>
            ))}
          </div>

          <section className="stat-dashboard" aria-label={`${selectedMember.name} tuning dashboard`}>
            <div className="section-title compact-title">
              <Activity size={18} />
              <h2>Damage Lab</h2>
            </div>

            <FieldGroup title="Base">
              <NumberControl label="Character ATK" min={1} onChange={setSelectedBaseAttack} step={100} value={selectedMember.baseAttack} />
              <NumberControl label="Grid ATK" min={0} onChange={(value) => setBattle((current) => ({
                ...current,
                weaponGrid: { ...current.weaponGrid, attack: clamp(Math.round(value), 0, 999999) },
                lastActionSummary: "Grid ATK adjusted",
              }))} step={100} value={battle.weaponGrid.attack} />
              <NumberControl label="Max HP" min={1} onChange={setSelectedMaxHp} step={100} value={selectedMember.maxHp} />
              <RangeControl label="Current HP" max={selectedMember.maxHp} onChange={setSelectedHp} step={100} suffix="" value={selectedMember.hp} />
              <RangeControl label="Charge Bar" max={100} onChange={setSelectedChargeBar} step={5} value={selectedMember.chargeBar} />
              <RangeControl label="Double Attack" max={100} onChange={(value) => setSelectedMultiattack("double", value)} value={Math.round(selectedMember.multiattack.double * 100)} />
              <RangeControl label="Triple Attack" max={100} onChange={(value) => setSelectedMultiattack("triple", value)} value={Math.round(selectedMember.multiattack.triple * 100)} />
            </FieldGroup>

            <FieldGroup title="Attack Buckets">
              <RangeControl label="Normal ATK" max={500} onChange={(value) => updateGridModifier("normal-atk", "normal", value)} value={gridModifier("normal-atk")} />
              <RangeControl label="Omega ATK" max={500} onChange={(value) => updateGridModifier("omega-atk", "omega", value)} value={gridModifier("omega-atk")} />
              <RangeControl label="EX ATK" max={300} onChange={(value) => updateGridModifier("ex-atk", "ex", value)} value={gridModifier("ex-atk")} />
              <RangeControl label="Unique ATK" max={200} onChange={(value) => updatePersonalModifier("unique-passive", "unique", value)} value={personalModifier("unique-passive")} />
              <RangeControl label="Seraphic" max={30} onChange={(value) => updatePersonalModifier("seraphic-passive", "seraphic", value)} value={personalModifier("seraphic-passive")} />
              <RangeControl label="DMG Amplified" max={50} onChange={(value) => updateGridModifier("amplified-dmg", "amplified", value)} value={gridModifier("amplified-dmg")} />
            </FieldGroup>

            <FieldGroup title="HP Conditional">
              <RangeControl label="Stamina at full HP" max={100} onChange={(value) => updateGridModifier("stamina-atk", "stamina", value)} value={gridModifier("stamina-atk")} />
              <RangeControl label="Enmity strength" max={100} onChange={(value) => updateGridModifier("enmity-atk", "enmity", value)} value={gridModifier("enmity-atk")} />
            </FieldGroup>

            <FieldGroup title="Damage Type">
              <RangeControl label="Skill DMG" max={300} onChange={(value) => updateGridModifier("skill-dmg", "skillDamage", value)} value={gridModifier("skill-dmg")} />
              <RangeControl label="C.A. DMG" max={300} onChange={(value) => updateGridModifier("ca-dmg", "caDamage", value)} value={gridModifier("ca-dmg")} />
              <RangeControl label="Bonus DMG" max={100} onChange={updateBonusDamage} value={bonusDamage} />
            </FieldGroup>

            <FieldGroup title="Damage Cap">
              <RangeControl label="Normal Cap" max={20} onChange={(value) => updateWeaponCap("normal-cap-up", ["normal", "counter"], value)} value={capModifier("normal-cap-up")} />
              <RangeControl label="Skill Cap" max={20} onChange={(value) => updateWeaponCap("skill-cap-up", ["skill"], value)} value={capModifier("skill-cap-up")} />
              <RangeControl label="C.A. Cap" max={20} onChange={(value) => updateWeaponCap("ca-cap-up", ["charge"], value)} value={capModifier("ca-cap-up")} />
            </FieldGroup>

            <FieldGroup title="Critical / Supplemental">
              <RangeControl label="Crit Rate" max={100} onChange={(value) => updateCritical("chance", value)} value={percentValue(critical?.chance ?? 0)} />
              <RangeControl label="Crit DMG" max={200} onChange={(value) => updateCritical("damage", value)} value={percentValue(critical?.damage ?? 0)} />
              <NumberControl label="Normal Supplemental" min={0} onChange={(value) => updateSupplemental("normal-supp", ["normal", "counter"], value)} step={10000} value={supplemental("normal-supp")} />
              <NumberControl label="Skill Supplemental" min={0} onChange={(value) => updateSupplemental("skill-supp", ["skill"], value)} step={10000} value={supplemental("skill-supp")} />
              <NumberControl label="C.A. Supplemental" min={0} onChange={(value) => updateSupplemental("ca-supp", ["charge"], value)} step={10000} value={supplemental("ca-supp")} />
            </FieldGroup>
          </section>
        </aside>

        <section className="battle-stage" aria-label="Battle stage">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Turn {battle.turn}</p>
              <h2>{battle.enemy.name}</h2>
            </div>
            <div className={`mode-badge ${battle.enemy.mode}`}>
              <Activity size={18} />
              {battle.enemy.mode}
            </div>
          </div>

          <section className="enemy-board" aria-label="Enemy state">
            <div className="enemy-core">
              <div className="enemy-sigil">
                <Flame size={54} />
              </div>
              <div>
                <h3>{battle.enemy.name}</h3>
                <p>
                  Foe / DEF {battle.enemy.defense} / charge {battle.enemy.chargeDiamonds}/
                  {battle.enemy.maxChargeDiamonds}
                </p>
              </div>
            </div>
            <div className="large-hp">
              <span>{formatNumber(battle.enemy.hp)} HP</span>
              <i style={{ width: enemyHpRate }} />
            </div>
          </section>

          <section className="command-deck" aria-label="Battle commands">
            <button className="primary-command" onClick={() => setBattle(attackTurn)} type="button">
              <Swords size={20} />
              Attack Turn
            </button>
            <button onClick={() => setBattle(createInitialBattleState())} type="button">
              <RotateCcw size={18} />
              Reset
            </button>
          </section>

          <section className="skill-grid" aria-label={`${selectedMember.name} skills`}>
            <div className="section-title">
              <Zap size={18} />
              <h2>{selectedMember.name} Skills</h2>
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

          <section className="battle-strip" aria-label="Damage preview">
            <div>
              <Axe size={18} />
              Base {formatNumber(selectedPreview.baseDamage)}
            </div>
            <div>
              <Flame size={18} />
              Advantage x{DEFAULT_ADVANTAGE_MULTIPLIER}
            </div>
            <div>
              <Sparkles size={18} />
              Cap {formatNumber(selectedPreview.cap)}
            </div>
            <div>
              <Zap size={18} />
              Hit {formatNumber(selectedPreview.finalDamage)}
            </div>
            <div>
              <Sparkles size={18} />
              Crit x{selectedPreview.criticalMultiplier}
            </div>
            <div>
              <Axe size={18} />
              Supp {formatNumber(selectedPreview.supplementalDamage)}
            </div>
          </section>
        </section>

        <aside className="panel systems-panel">
          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>Systems</h2>
          </div>
          <ul className="system-list compact">
            {coveredSystems.map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
          <div className="formula-card">
            <h3>Formula Stack</h3>
            <p>
              Character ATK, weapon grid, default advantage, buffs, debuffs, unique bucket,
              crit, soft cap, and skill hit count.
            </p>
          </div>
        </aside>
      </section>

      <section className="log-dock" aria-label="Battle log">
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
                <span>T{entry.turn}</span>
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
