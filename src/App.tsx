import { useMemo, useState } from "react";
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
import { elementMultiplier, resolveHit } from "./game/formulas";
import { describeSkill } from "./game/skillText";
import type { BattleState, Combatant } from "./game/types";

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
  "Element matchup",
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
  const elementRate = elementMultiplier(selectedMember.element, battle.enemy.element);

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
                  <small>{member.element.toUpperCase()}</small>
                </span>
              </button>
            ))}
          </div>
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
                  {battle.enemy.element.toUpperCase()} foe / DEF {battle.enemy.defense} /
                  charge {battle.enemy.chargeDiamonds}/{battle.enemy.maxChargeDiamonds}
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
              Element x{elementRate}
            </div>
            <div>
              <Sparkles size={18} />
              Cap {formatNumber(selectedPreview.cap)}
            </div>
            <div>
              <Zap size={18} />
              Hit {formatNumber(selectedPreview.finalDamage)}
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
              Character ATK, weapon grid, element, buffs, debuffs, unique bucket, crit,
              soft cap, and skill hit count.
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
