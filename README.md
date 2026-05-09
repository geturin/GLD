# GLD

GLD is planned as a browser-based GBF-like + DRPG game.

The project should combine Granblue Fantasy-inspired combat and progression systems with dungeon RPG structure. Core references include GBF-style damage formulas, weapon grids, summons, elements, buffs/debuffs, charge attacks, damage caps, party/class systems, and enemy battle flow, adapted into a DRPG loop of dungeon exploration, encounters, party building, and long-term progression.

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
