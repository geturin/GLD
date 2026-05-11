# GLD Buff / Debuff 管理表

本表整理自 GBF Wiki 的 Status Effects 与 Category:Status Effects。GLD 的实现原则是：状态效果必须带有可管理的分类，不允许只靠技能代码临时叠加。

参考来源：

- https://gbf.wiki/Status_Effects
- https://gbf.wiki/Category:Status_Effects

## 覆盖规则

GBF Wiki 的关键规则是：状态效果有不可见的 stacking frame / side。相同 side 的同类效果通常只保留最强效果；更强或相同强度的新效果会覆盖旧效果，持续时间也覆盖而不是延长。不同 side 的相似效果可以并存，例如 Dual DEF Down 与 Single DEF Down 可以同时存在。

GLD 采用以下字段：

- `stackingKey`：状态家族，例如 `atk-up`、`def-down`、`bonus-damage`。
- `stackingSide`：同家族中的分类，例如 `normal`、`single`、`dual`、`stackable`、`unique`、`special`、`local`、`global`、`field`。
- `stackingRule`：
  - `replace`：同 `stackingKey + stackingSide` 互相覆盖，强者优先。
  - `stack`：累积层数，到 `maxStacks` 停止。
  - `unique`：独特状态本体可独立存在，但同 key 仍覆盖。

技能数据编写规则：

- 同一个 Buff/Debuff：同 `stackingKey` 且同 `stackingSide`，覆盖。
- 效果相似但分类不同：同 `stackingKey`、不同 `stackingSide`，并存。
- 复合状态可以做成一个 StatusEffect，但应使用复合 key，例如 `atk-def-down` + `dual`。
- Local / Global / Field 要与普通状态分开，不要共用 side。

## 当前已接入的效果字段

以下字段已进入战斗流程或伤害公式：

- 伤害公式：`modifiers`、`capUp`、`supplemental`、`multiattack`、`defenseUp`、`defenseDown`、`attackDown`、`damageCut`、`damageReduction`、`damageTakenAmplified`、`sleepDamageTakenAmplified`、`specialAttackDamageDown`
- 受击处理：`accuracyDown`、`dodgeRate`、`armored`、`shield`、`mirrorImage`、`unchallenged`、`guts`
- 回合结束：`refresh`、`revitalize`、`uplift`、`autoignition`、`instantCharge`、`turnDamage`、`drain`、`maxHpLowered`、`vaccine`
- 敌方行动：`chargeDiamondsMaxUp`、`chargeDiamondsFrozen`、`cannotAct`、`cannotActChance`、`debuffResistanceDown`
- 保护与移除接口：`veil`、`immune`、`dispelCancel`

仍依赖未来系统的条目：

- 多敌人/仇恨系统：`Attack All`、`Hostility Up`、`Hostility Down`
- 召唤系统：`Summon Cooldown Cut`
- 预兆系统：`Cancel Omen`、`Cap Damage Taken`
- 前后排/换人系统：`Sub Ally Support Skills`、`Switch Ally`
- 场地系统：Field Effects
- 掉落/经验系统：`Bounty`、`EXP Boost`、`RP Boost`

## Buff 类型

Offensive:

- ATK Up
- Assassin / Sharp ATK Up
- Attack All
- Attack Count
- Bonus Damage
- C.A. DMG Up
- C.A. DMG Cap Up
- C.A. Flash
- C.A. Reactivation
- Chain Burst Damage Up
- Chain Burst Damage Cap Up
- Critical Hit Rate Boosted
- Counter
- Damage Amplified
- Double Attack Rate Up
- Debuff Success Boosted
- Damage Cap Up
- Elemental ATK Up
- Flurry
- Hype
- Instant Recast
- Jammed
- Keen
- Multistrike
- Piercing Sight
- Quadruple Attack Rate Up
- Skill Damage Up
- Skill Damage Cap Up
- Special C.A. Damage Cap Up
- Strength
- Supplemental Damage
- Triple Attack Rate Up

Defensive:

- Armored
- DEF Up
- Debuff Resistance Up
- Dispel Cancel
- Damage Cut
- Damage Mitigation
- Dodge All
- Dodge Rate Up
- Elemental Switch
- Guts / Undying
- Immune
- Mirror Image
- Repel
- Shield
- Substitute
- Unchallenged
- Veil

Restorative:

- Autorevive
- Death's Grace
- Damage Absorption
- Drain
- Refresh
- Revitalize
- Vaccine

Charge Bar:

- Autoignition
- Charge Bar Boost
- Charge Bar Gain Up
- Charged
- Instant Charge
- Uplifted

Other:

- Buff Effect Extended
- Crests
- Fated Chain Bar Boost
- Hostility Down
- Hostility Up
- Special Buff

## Debuff 类型

Enfeeblement:

- Accuracy Lowered
- ATK Down
- Blind
- Cold Stare
- Corrosion
- Double Attack Rate Down
- Debuff Resistance Down
- DEF Down
- Delay
- Delay Drain
- Damage Taken Amplified
- Elemental ATK Down
- Elemental DEF Down
- Fated Chain Damage Taken Amplified
- Forfeit
- Foxflame
- Glaciate
- Gravity
- Petrified
- Special Attack Damage Lowered
- Triple Attack Rate Down
- Thunderstruck
- Zombified

Disabling:

- Break Boosted
- Can't Act
- Charm
- Coldcage
- Comatose
- Paralyzed
- Sleep
- Stared Stiff
- Stone
- Stunned
- Terror

Turn-Based Damage:

- Burned
- Poisoned
- Putrefied
- Singed
- Toxicosis
- Tune

Other:

- Bounty
- Confrontation
- Elemental Conversion
- Lethal Hit
- Max HP Lowered
- Onslaught

## Field / Battle Effects

Global field effects:

- Atomic Collapse
- Blizzard
- Chaos
- Flare
- Spacial Rupture
- Twilight Zone

Local field effects:

- Aureole of Life
- Ballroom
- Flames of the Underworld
- Holy Rays of Purgation
- Iliofaneia
- Malice of Despair
- Mosh
- Spooky Utopia
- Sun-Touched Paradise
- Tranquil Grounds
- Unlimited Void
- Utopia
- World of Death and Love

Battle effects:

- Clear
- Create Potion
- Debuff Duration Cut
- Healing
- Revive
- Buff Duration Cut
- Cancel Omen
- Cap Damage Taken
- Consume HP
- Dispel
- EXP Boost
- Facsimile
- Instant Attack
- Mode Bar Cut
- RP Boost
- Skill Cooldown Cut
- Sub Ally Support Skills
- Summon Cooldown Cut
- Switch Ally
- Turn Progression
- Unworldly Charge Attack
