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
- 有随机伤害浮动开关。
- 有 DEF Down 50% 上限、DEF Up、Damage Cut、Damage Reduction 的第一版字段和计算。
- 有普通、反击、奥义、技能、连锁爆发的分类软上限表。
- 有状态叠加/覆盖规则、弱体命中率/敌方抗性、敌方触发器结构。
- 有追击独立伤害实例、补充伤害条件/来源/上限字段。

## 仍需未来扩展

1. **召唤系统**
   - 当前按项目要求暂不做。
   - 未来如果需要 GBF-like 盘子深度，召唤 aura/call 会影响大量乘区。

2. **武器技能细分**
   - GBF 有 Normal/Omega/EX 的 ATK、Stamina、Enmity、Crit、上限、特殊技能等。
   - GLD 当前把它们合并为简单 modifier。
   - 建议未来把 `WeaponSkill` 独立成数据表，再汇总为公式输入。

3. **暴击规则**
   - GBF 暴击来源独立判定，且与克制/特定场地/特殊效果有关。
   - GLD 已有独立判定雏形，但缺暴击补充、暴击上限等。

4. **多角色行动顺序**
   - 当前是单角色 Demo。
   - 未来上队伍后需要完整 action order、frontline/backline、死亡替补、保护/敌对心等。

5. **敌方模式和 Break/Overdrive**
   - GLD 当前按 HP/模式条简化。
   - GBF 有敌方 mode gauge、OD 技、Break 延迟 CT 等更多细节。
