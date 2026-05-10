# Project Core Memory

This workspace is for building a game whose core direction is:

- A web game with a GBF-like + DRPG core.
- GBF-like means the project should study and adapt Granblue Fantasy-style combat, progression, party, weapon grid, summon, buff/debuff, charge attack, damage formula, and cap systems.
- Unlike GBF, this game intentionally does not have element identities or element matchup selection. Combat should default to the player fighting with advantage; formula code uses a fixed default advantage multiplier instead of character/enemy element fields.
- DRPG means the project should combine those systems with dungeon RPG structure: dungeon exploration, party building, encounters, progression, and repeatable run/expedition loops.
- The current development environment is a browser app: Vite + React + TypeScript for the UI/application shell, with PixiJS available for future 2D dungeon or battle rendering.
- Battle logic should stay data-driven and modifier-based. Formula code lives under `src/game/`, with combat types, damage formulas, demo state, and the battle engine separated so future skills, weapon skills, summons, buffs, debuffs, EMPs, and enemy mechanics can add modifiers without rewriting the core formulas.
- The current battle demo is intentionally scoped to one playable character and does not implement the summon system yet. Demo skill descriptions are generated from skill data variables, so changing cooldowns, durations, hit counts, caps, or modifier values should automatically update the UI text.
- The combat demo should expose a rich tuning dashboard for GBF-like damage research. Keep base stats, grid ATK, Normal/Omega/EX/Unique/Seraphic/Amplified buckets, Stamina, Enmity, skill/C.A. damage, bonus damage, categorized damage caps, critical, and supplemental damage adjustable from data-backed controls.
- Weapon grid logic uses 4 mainhand slots plus a 3x3 sub grid. Mainhand slots unlock from current party size, so the one-character demo uses 1+3x3 active slots. Weapon definitions and aggregation live in `src/game/weaponGrid.ts`; weapons should contribute shared ATK/HP and passive effects to the whole party.
- Use `docs/combat-system-gap-analysis.md` as the current comparison between GBF wiki combat flow and GLD's implementation. The first ten listed combat gaps have been implemented as a first pass; future work should focus on the remaining extension notes or on refining those first-pass systems.
- Future development should use Simplified Chinese as the base product language. User-facing UI strings should live in locale files under `src/i18n/` instead of being hard-coded in React components or game logic, so later language packs can be added cleanly.
- This is the central product identity of the project. Future Codex sessions should preserve this direction and avoid drifting into a generic RPG, idle game, or unrelated combat prototype.

# GBF English Wiki System Reference Index

Source: https://gbf.wiki/

## Core Damage System

- [Damage Formula](https://gbf.wiki/Damage_Formula)
- [Detailed Damage Formula](https://gbf.wiki/Damage_Formula/Detailed_Damage_Formula)
- [Damage Cap](https://gbf.wiki/Damage_Cap)
- [Damage Cap Up](https://gbf.wiki/Damage_Cap_Up)

## Attack Mechanics

- [Multiattack Rate](https://gbf.wiki/Multiattack_Rate)
- [Critical Hit](https://gbf.wiki/Critical_Hit)
- [Bonus Damage](https://gbf.wiki/Bonus_Damage)
- [Supplemental Damage](https://gbf.wiki/Supplemental_Damage)

## Charge Attack System

- [Charge Attack](https://gbf.wiki/Charge_Attack)
- [Chain Burst](https://gbf.wiki/Chain_Burst)
- [Charge Bar](https://gbf.wiki/Charge_Bar)

## Weapon System

- [Weapon Skills](https://gbf.wiki/Weapon_Skills)
- [Weapon Grid](https://gbf.wiki/Weapon_Grid)
- [Advanced Grids](https://gbf.wiki/Advanced_Grids)

## Summon System

- [Summons](https://gbf.wiki/Summons)
- [Summon Aura](https://gbf.wiki/Summon_Aura)

## Element System

GBF has element systems, but GLD intentionally does not implement element identities or matchup selection.

- [Elements](https://gbf.wiki/Elements)
- [Elemental Damage](https://gbf.wiki/Elemental_Damage)

## Buff / Debuff System

- [Status Effects](https://gbf.wiki/Status_Effects)
- [Buffs](https://gbf.wiki/Buffs)
- [Debuffs](https://gbf.wiki/Debuffs)

## Defense and Enemy System

- [Defense](https://gbf.wiki/Defense)
- [Enemy Mechanics](https://gbf.wiki/Enemy_Mechanics)
- [Overdrive](https://gbf.wiki/Overdrive)
- [Break Mode](https://gbf.wiki/Break_Mode)

## Battle Flow System

- [Battle System](https://gbf.wiki/Battle_System)
- [Turn](https://gbf.wiki/Turn)
- [Action Order](https://gbf.wiki/Action_Order)

## Character and Class System

- [Characters](https://gbf.wiki/Characters)
- [Classes](https://gbf.wiki/Classes)
- [Extended Mastery Perks](https://gbf.wiki/Extended_Mastery_Perks)

## Advanced Damage Modifiers

- [Enmity](https://gbf.wiki/Enmity)
- [Stamina](https://gbf.wiki/Stamina)
- [Skill Damage](https://gbf.wiki/Skill_Damage)
- [Charge Attack Damage](https://gbf.wiki/Charge_Attack_Damage)

## Special Battle Mechanics

- [Counters](https://gbf.wiki/Counters)
- [Substitute](https://gbf.wiki/Substitute)
- [Dispel](https://gbf.wiki/Dispel)
- [Delay](https://gbf.wiki/Delay)
