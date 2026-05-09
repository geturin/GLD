import {
  Activity,
  Axe,
  Flame,
  Gem,
  Map,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";

const party = [
  { name: "Vanguard", role: "MC / Tank", element: "Fire", hp: "18,420" },
  { name: "Hexblade", role: "Attacker", element: "Dark", hp: "13,880" },
  { name: "Cantor", role: "Buffer", element: "Wind", hp: "12,760" },
  { name: "Mender", role: "Healer", element: "Water", hp: "14,210" },
];

const systems = [
  "Weapon grid multipliers",
  "Element advantage",
  "Buff and debuff layers",
  "Charge attack cadence",
  "Damage cap pressure",
];

const dungeonRows = [
  ["start", "path", "path", "relic", "path"],
  ["void", "wall", "path", "wall", "path"],
  ["path", "path", "elite", "path", "camp"],
  ["path", "wall", "path", "wall", "path"],
  ["treasure", "path", "path", "boss", "exit"],
];

export function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GBF-like DRPG web game</p>
          <h1>GLD Command Deck</h1>
        </div>
        <nav className="mode-tabs" aria-label="Game work modes">
          <button className="active" type="button">
            <Map size={18} />
            Dungeon
          </button>
          <button type="button">
            <Swords size={18} />
            Battle
          </button>
          <button type="button">
            <Gem size={18} />
            Grid
          </button>
        </nav>
      </header>

      <section className="game-layout" aria-label="Game prototype workspace">
        <aside className="panel party-panel">
          <div className="panel-heading">
            <Shield size={18} />
            <h2>Party</h2>
          </div>
          <div className="party-list">
            {party.map((member) => (
              <article className="party-card" key={member.name}>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </div>
                <dl>
                  <div>
                    <dt>Element</dt>
                    <dd>{member.element}</dd>
                  </div>
                  <div>
                    <dt>HP</dt>
                    <dd>{member.hp}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </aside>

        <section className="stage" aria-label="Dungeon map">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Expedition 01</p>
              <h2>Azure Foundry Depths</h2>
            </div>
            <div className="turn-meter">
              <Activity size={18} />
              Turn 04
            </div>
          </div>
          <div className="dungeon-grid" role="img" aria-label="Five by five dungeon route map">
            {dungeonRows.flatMap((row, rowIndex) =>
              row.map((cell, columnIndex) => (
                <span
                  className={`dungeon-cell ${cell}`}
                  key={`${rowIndex}-${columnIndex}`}
                  title={cell}
                />
              )),
            )}
          </div>
          <div className="battle-strip" aria-label="Battle forecast">
            <div>
              <Axe size={18} />
              Enemy DEF 10
            </div>
            <div>
              <Flame size={18} />
              Fire advantage
            </div>
            <div>
              <Sparkles size={18} />
              CA chain ready
            </div>
          </div>
        </section>

        <aside className="panel systems-panel">
          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>Core Systems</h2>
          </div>
          <ul className="system-list">
            {systems.map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
          <div className="render-note">
            PixiJS is installed for the future canvas renderer; this first screen keeps the
            tactical UI in React so combat and grid logic can grow cleanly.
          </div>
        </aside>
      </section>
    </main>
  );
}
