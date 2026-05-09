# GLD

GLD is planned as a browser-based GBF-like + DRPG game.

The project should combine Granblue Fantasy-inspired combat and progression systems with dungeon RPG structure. Core references include GBF-style damage formulas, weapon grids, summons, buffs/debuffs, charge attacks, damage caps, party/class systems, and enemy battle flow, adapted into a DRPG loop of dungeon exploration, encounters, party building, and long-term progression.

GLD intentionally does not use element identities or selectable element matchups. Battles default to an advantageous matchup baseline so the game can focus on grid, skill, buff/debuff, cap, and dungeon progression decisions.

## Development

This project uses Vite, React, and TypeScript for the web game shell. PixiJS is included for future 2D dungeon and battle rendering.

```sh
npm install
npm run dev
```

Useful scripts:

- `npm run dev` starts the local development server.
- `npm run build` type-checks and builds the production bundle.
- `npm run preview` serves the built bundle locally.
