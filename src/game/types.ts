export type AttackKind = "normal" | "charge" | "skill" | "counter" | "chainBurst";

export type CapSource = "weapon" | "summon" | "buff" | "passive" | "special";

export type StatusPolarity = "buff" | "debuff" | "mixed";

export type StatusStackingRule = "replace" | "stack" | "unique";

export type StatusStackingSide =
  | "normal"
  | "single"
  | "dual"
  | "stackable"
  | "unique"
  | "local"
  | "global"
  | "field"
  | "special";

export type DamageInstanceKind = "primary" | "bonus" | "supplemental";

export type EnemyTriggerTiming = "afterSkill" | "afterAttack" | "endTurn";

export type ModifierBucket =
  | "normal"
  | "omega"
  | "ex"
  | "advantage"
  | "unique"
  | "seraphic"
  | "stamina"
  | "enmity"
  | "caDamage"
  | "skillDamage"
  | "amplified";

export interface ScalarModifier {
  id: string;
  label: string;
  bucket: ModifierBucket;
  value: number;
  boostable?: boolean;
}

export interface DamageCapModifier {
  id: string;
  label: string;
  source: CapSource;
  appliesTo: AttackKind[];
  value: number;
  boostable?: boolean;
}

export interface CriticalRule {
  id: string;
  label: string;
  chance: number;
  damage: number;
  boostable?: boolean;
}

export interface BonusDamageRule {
  id: string;
  label: string;
  multiplier: number;
  appliesTo?: AttackKind[];
  cap?: number;
  boostable?: boolean;
}

export interface SupplementalRule {
  id: string;
  label: string;
  amount: number;
  appliesTo: AttackKind[];
  cap?: number;
  condition?: "always" | "critical";
  sourceType?: "weapon" | "skill" | "status" | "passive";
  boostable?: boolean;
}

export interface MultiattackProfile {
  double: number;
  triple: number;
}

export interface StatusEffect {
  id: string;
  label: string;
  duration: number;
  polarity?: StatusPolarity;
  stackingKey?: string;
  stackingSide?: StatusStackingSide;
  stackingRule?: StatusStackingRule;
  stack?: number;
  maxStacks?: number;
  local?: boolean;
  dispellable?: boolean;
  accuracy?: number;
  modifiers?: ScalarModifier[];
  capUp?: DamageCapModifier[];
  supplemental?: SupplementalRule[];
  multiattack?: Partial<MultiattackProfile>;
  defenseUp?: number;
  defenseDown?: number;
  attackDown?: number;
  damageCut?: number;
  damageReduction?: number;
  debuffResistanceDown?: number;
}

export interface SkillDefinition {
  id: string;
  label: string;
  cooldown: number;
  remainingCooldown: number;
  kind: "damage" | "buff" | "debuff" | "delay" | "dispel" | "substitute" | "counter";
  target: "self" | "party" | "enemy";
  hitCount?: number;
  damageMultiplier?: number;
  damageCap?: number;
  chargeGain?: number;
  applies?: StatusEffect[];
}

export interface Combatant {
  id: string;
  name: string;
  role: string;
  spriteUrl?: string;
  spriteSet?: Partial<Record<"idle" | "walk1" | "walk2" | "attack" | "hurt" | "skill" | "victory", string>>;
  maxHp: number;
  hp: number;
  baseAttack: number;
  chargeBar: number;
  multiattack: MultiattackProfile;
  chargeAttack: {
    label: string;
    multiplier: number;
    cap: number;
    fixedDamage: number;
  };
  skills: SkillDefinition[];
  personalModifiers: ScalarModifier[];
  critical: CriticalRule[];
  bonusDamage: BonusDamageRule[];
  supplemental: SupplementalRule[];
  capUp: DamageCapModifier[];
  statusEffects: StatusEffect[];
  substituteForTeam?: boolean;
  counterStacks?: number;
}

export interface WeaponGrid {
  name: string;
  mainhands: Array<EquippedWeapon | null>;
  subSlots: Array<EquippedWeapon | null>;
  activeMainhandCount: number;
  attack: number;
  hp: number;
  modifiers: ScalarModifier[];
  critical: CriticalRule[];
  capUp: DamageCapModifier[];
  supplemental: SupplementalRule[];
  bonusDamage: BonusDamageRule[];
  multiattack: Partial<MultiattackProfile>;
  defenseIgnore: number;
  skillBoost: number;
}

export interface EquippedWeapon {
  weaponId: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  series: string;
  weaponType: "sword" | "katana";
  attack: number;
  hp: number;
  skills: WeaponSkill[];
}

export interface WeaponSkill {
  id: string;
  label: string;
  description: string;
  effects: WeaponSkillEffects;
}

export interface WeaponSkillEffects {
  modifiers?: ScalarModifier[];
  critical?: CriticalRule[];
  capUp?: DamageCapModifier[];
  supplemental?: SupplementalRule[];
  bonusDamage?: BonusDamageRule[];
  multiattack?: Partial<MultiattackProfile>;
  defenseIgnore?: number;
  skillBoost?: number;
}

export interface Enemy {
  id: string;
  name: string;
  spriteUrl?: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  chargeDiamonds: number;
  maxChargeDiamonds: number;
  mode: "normal" | "overdrive" | "break";
  modeGauge: number;
  debuffResistance: number;
  statusEffects: StatusEffect[];
  triggers: EnemyTrigger[];
  triggeredIds: string[];
}

export interface BattleState {
  turn: number;
  party: Combatant[];
  enemy: Enemy;
  weaponGrid: WeaponGrid;
  log: BattleLogEntry[];
  chainCount: number;
  lastActionSummary: string;
  options: BattleOptions;
}

export interface BattleOptions {
  randomVariance: boolean;
}

export type BattleSourceMotion = "attack" | "skill" | "hurt" | "victory";

export interface BattleLogEntry {
  id: string;
  turn: number;
  actor: string;
  action: string;
  detail: string;
  damage?: number;
  targetId?: string;
  targetType?: "enemy" | "party";
  sourceId?: string;
  sourceType?: "enemy" | "party";
  sourceMotion?: BattleSourceMotion;
  feedback?: "damage" | "buff" | "debuff";
  hitDamages?: number[];
}

export interface DamageContext {
  attacker: Combatant;
  enemy: Enemy;
  weaponGrid: WeaponGrid;
  kind: AttackKind;
  hitMultiplier: number;
  cap: number;
  criticalSeed: number;
  randomVariance?: boolean;
}

export interface DamageCapTier {
  threshold: number;
  reduction: number;
}

export interface DamageInstance {
  id: string;
  label: string;
  kind: DamageInstanceKind;
  damage: number;
}

export interface DamageBreakdown {
  baseDamage: number;
  preCapDamage: number;
  cappedDamage: number;
  finalDamage: number;
  supplementalDamage: number;
  bonusDamage: number;
  criticalMultiplier: number;
  varianceMultiplier: number;
  cap: number;
  hitCount: number;
  instances: DamageInstance[];
  notes: string[];
}

export interface EnemyTrigger {
  id: string;
  label: string;
  timing: EnemyTriggerTiming;
  once: boolean;
  priority: number;
  condition:
    | { type: "hpBelow"; threshold: number }
    | { type: "chargeFull" }
    | { type: "status"; statusId: string };
  action:
    | { type: "specialAttack"; multiplier: number }
    | { type: "fillCharge"; amount: number }
    | { type: "phaseChange"; mode: Enemy["mode"] };
}
