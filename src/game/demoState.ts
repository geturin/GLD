import characterData from "../data/characters.json";
import enemyData from "../data/enemies.json";
import { t } from "../i18n/zhCN";
import type { BattleState, Combatant, Enemy, WeaponDefinition } from "./types";
import {
  DEFAULT_WEAPON_CATALOG,
  DEFAULT_WEAPON_GRID_TEMPLATES,
  type WeaponGridTemplate,
  createDemoWeaponGrid,
} from "./weaponGrid";

export const DEFAULT_CHARACTERS = characterData as Combatant[];
export const DEFAULT_ENEMIES = enemyData as Enemy[];

export interface GameDataSets {
  characters: Combatant[];
  enemies: Enemy[];
  weapons: WeaponDefinition[];
  weaponGridTemplates: WeaponGridTemplate[];
}

export function createDefaultDataSets(): GameDataSets {
  return {
    characters: structuredClone(DEFAULT_CHARACTERS),
    enemies: structuredClone(DEFAULT_ENEMIES),
    weapons: structuredClone(DEFAULT_WEAPON_CATALOG),
    weaponGridTemplates: structuredClone(DEFAULT_WEAPON_GRID_TEMPLATES),
  };
}

export function createInitialBattleState(dataSets = createDefaultDataSets()): BattleState {
  const party = [structuredClone(dataSets.characters[0])];

  return {
    turn: 1,
    party,
    enemy: structuredClone(dataSets.enemies[0]),
    weaponGrid: createDemoWeaponGrid(
      party.length,
      dataSets.weapons,
      dataSets.weaponGridTemplates,
    ),
    log: [
      {
        id: "battle-start",
        turn: 1,
        actor: t.battle.system,
        action: t.battle.encounter,
        detail: t.battle.encounterDetail,
      },
    ],
    chainCount: 0,
    lastActionSummary: t.battle.ready,
    options: {
      randomVariance: true,
    },
  };
}
