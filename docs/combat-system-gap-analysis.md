# GLD 战斗计算流程梳理

本文对照 GBF wiki 的战斗/伤害资料，整理 GBF 的主要计算流程、GLD 当前实现，以及后续建议补全项。

资料参考：

- https://gbf.wiki/Damage_Formula/Detailed_Damage_Formula
- https://gbf.wiki/Damage_Cap
- https://gbf.wiki/Damage_Cap_Up
- https://gbf.wiki/Multiattack_Rate
- https://gbf.wiki/Critical_Hit
- https://gbf.wiki/Bonus_Damage
- https://gbf.wiki/Supplemental_Damage
- https://gbf.wiki/Charge_Attack
- https://gbf.wiki/Chain_Burst
- https://gbf.wiki/Status_Effects
- https://gbf.wiki/DEF_Down
- https://gbf.wiki/Triggers

## 项目取舍

GLD 不是 GBF 复刻，而是 GBF-like + DRPG。当前已经确定：

- 不做属性身份和属性相克选择。
- 所有战斗默认按克制基线处理。
- 当前 Demo 暂不做召唤兽系统。
- 当前 Demo 以单角色战斗和数值调试为主。

因此 GBF 中和元素身份、召唤 aura、多人 raid 全局状态强绑定的内容，只作为未来可选扩展，不作为当前必须补全项。

## GBF 大致计算流程

GBF 一次伤害通常可以拆成：

1. 确定行动类型：普通攻击、奥义、技能、反击、连锁爆发、固定伤害等。
2. 计算角色总攻击力：角色 ATK、武器 ATK、召唤 ATK、武器得意等。
3. 计算基础乘区：Normal、Omega、EX、元素、独立、角色特殊乘区、浑身、背水等。
4. 处理敌方防御：固有 DEF、DEF Up、DEF Down、Unique DEF Down、上限规则。
5. 处理行动类型倍率：普通攻击、技能倍率、奥义倍率、反击倍率等。
6. 处理随机浮动：普通攻击有约 0.95 到 1.05 的波动。
7. 处理暴击：通常按每个暴击来源独立判定，成功后加成。
8. 套用软上限：普通、奥义、技能等各自有不同上限表。
9. 套用上限提升：普通上限、技能上限、奥义上限、通用上限、伤害放大等。
10. 处理最终伤害类乘区：如 Seraphic、部分 Damage Amplified。
11. 处理追击：追击是独立伤害实例。
12. 处理补充伤害：按每个伤害实例加算，多 hit 技能会逐 hit 加算。
13. 处理硬上限：部分战斗存在 13.1m 或 6.6m 一类硬上限。
14. 处理奥义槽、连击、连锁爆发、敌方 CT、触发器、状态回合推进。

## GLD 当前流程

当前实现位于：

- `src/game/formulas.ts`
- `src/game/battleEngine.ts`
- `src/game/types.ts`
- `src/game/demoState.ts`

当前流程：

1. 玩家使用技能或点击攻击回合。
2. `resolveHit` 统一计算普通、奥义、技能、反击伤害。
3. 基础伤害使用：
   - 角色 ATK
   - 武器盘 ATK
   - Normal / Omega / EX
   - 默认克制倍率
   - Unique
   - Seraphic
   - Amplified
   - Stamina
   - Enmity
   - 技能伤害 / 奥义伤害
   - 敌方 DEF Down
4. 暴击按当前规则判定。
5. 软上限使用简化版三段衰减。
6. 上限提升按 `DamageCapModifier` 分类处理，武器来源有 20% 简化上限。
7. 追击按 capped damage 的比例追加。
8. 补充伤害按 hit 数加算。
9. 普通攻击根据 DA/TA 决定 hit 数。
10. 奥义满 100% 时替代普通攻击。
11. 2 个以上奥义会触发简化连锁爆发。
12. 敌方 CT 满时释放简化特殊技。
13. 状态效果按回合递减。

## 已覆盖较好的部分

- 分离了战斗类型、公式、状态和 Demo 数据。
- 有 Normal / Omega / EX / Unique / Seraphic / Amplified 基础乘区。
- 有浑身、背水 HP 条件乘区。
- 有普通、技能、奥义分类上限。
- 有暴击、追击、补充伤害。
- 有普通攻击 DA/TA。
- 有奥义、连锁爆发、CT、Overdrive/Break 的雏形。
- 有角色和敌人的统一状态显示。
- 有数值仪表盘，适合快速测试。

## 主要遗漏和建议优先级

### P0：公式正确性基础

1. **随机伤害浮动**
   - GBF 普通攻击等伤害有约 0.95 到 1.05 的随机波动。
   - GLD 当前没有随机浮动。
   - 建议加 `randomVariance`，并允许仪表盘切换“固定期望 / 随机模拟”。

2. **敌方 DEF 公式和 DEF Down 上限**
   - GBF 敌方 DEF Down 通常有 50% 上限，并有不同 stacking side。
   - GLD 当前只是简单累加 `defenseDown`。
   - 建议先补总 DEF Down 50% cap，再逐步加 stack side。

3. **ATK Down / DEF Up / Damage Cut / Damage Reduction**
   - GLD 只有敌方 ATK Down 和 DEF Down。
   - 缺敌我双方 DEF Up、Damage Cut、Damage Taken Down、无敌/回避等防御层。
   - 建议先补 `defenseUp`、`damageCut`、`damageReduction` 字段。

4. **软上限表**
   - GBF 普通、奥义、技能有各自上限表，不只是统一三段衰减。
   - GLD 当前 `applySoftCap` 是通用简化表。
   - 建议把 cap table 数据化：`normalCapTable`、`chargeCapTable`、`skillCapTable`。

### P1：GBF-like 体验核心

5. **状态叠加和覆盖规则**
   - GBF 状态有效果来源、local/global、turn/time duration、同 side 覆盖等规则。
   - GLD 当前同名状态可重复堆叠。
   - 建议给 `StatusEffect` 增加：
     - `polarity`
     - `stackingSide`
     - `stackingRule`
     - `maxStacks`
     - `local`
     - `dispellable`

6. **技能命中/弱体成功率**
   - GBF Debuff 有 base accuracy、敌方 resistance、必中等概念。
   - GLD 当前 Debuff 必中。
   - 建议加 `accuracy`、`resistance`、`guaranteed`，先用于 Debuff。

7. **触发器系统**
   - GBF 敌人有 HP trigger、CT trigger、phase trigger、status trigger。
   - GLD 当前只有 CT 满特殊技。
   - DRPG Boss 也会需要触发器。
   - 建议加 `EnemyTrigger`：
     - `condition`
     - `priority`
     - `once`
     - `action`

8. **奥义槽细节**
   - GBF 奥义后队友 +10%，受击涨奥义，多段攻击奥义收益不同，200% 奥义槽角色有特殊处理。
   - GLD 当前普通攻击固定涨槽，奥义后直接回 10。
   - 建议把 charge gain 规则数据化。

9. **追击作为独立伤害实例**
   - GBF echo 是独立实例，和补充伤害、上限、显示 hit 有更细关系。
   - GLD 当前 bonusDamage 直接加到最终伤害，没有独立 breakdown。
   - 建议 `DamageBreakdown` 增加 `instances`，每个实例有 cap、supplemental、source。

10. **补充伤害来源上限和适用条件**
   - GBF 补充伤害有不同来源、适用类型和上限。
   - GLD 当前是简单按类型加算。
   - 建议为 `SupplementalRule` 增加 `cap`、`condition`、`sourceType`。

### P2：较复杂但未来重要

11. **召唤系统**
   - 当前按项目要求暂不做。
   - 未来如果需要 GBF-like 盘子深度，召唤 aura/call 会影响大量乘区。

12. **武器技能细分**
   - GBF 有 Normal/Omega/EX 的 ATK、Stamina、Enmity、Crit、上限、特殊技能等。
   - GLD 当前把它们合并为简单 modifier。
   - 建议未来把 `WeaponSkill` 独立成数据表，再汇总为公式输入。

13. **暴击规则**
   - GBF 暴击来源独立判定，且与克制/特定场地/特殊效果有关。
   - GLD 已有独立判定雏形，但缺暴击补充、暴击上限等。

14. **多角色行动顺序**
   - 当前是单角色 Demo。
   - 未来上队伍后需要完整 action order、frontline/backline、死亡替补、保护/敌对心等。

15. **敌方模式和 Break/Overdrive**
   - GLD 当前按 HP/模式条简化。
   - GBF 有敌方 mode gauge、OD 技、Break 延迟 CT 等更多细节。

## 建议下一步开发顺序

1. 数据化 cap table：替代当前统一 `applySoftCap`。
2. 补 DEF Down 50% cap、DEF Up、Damage Cut。
3. 把 `DamageBreakdown` 改成多实例结构，支持普通本体、追击、补充逐项显示。
4. 做状态 stacking/overwrite 规则。
5. 做敌方 trigger 系统。
6. 做 Debuff 命中率/抗性。
7. 做奥义槽规则细化。

这条路线能让 GLD 更接近 GBF-like 的计算骨架，同时不会因为一次性复刻 GBF 全系统而失控。
