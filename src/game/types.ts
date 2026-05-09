export type AttackKind = "normal" | "charge" | "skill" | "counter" | "chainBurst";

export type CapSource = "weapon" | "summon" | "buff" | "passive" | "special";

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
}

export interface DamageCapModifier {
  id: string;
  label: string;
  source: CapSource;
  appliesTo: AttackKind[];
  value: number;
}

export interface CriticalRule {
  id: string;
  label: string;
  chance: number;
  damage: number;
}

export interface BonusDamageRule {
  id: string;
  label: string;
  multiplier: number;
}

export interface SupplementalRule {
  id: string;
  label: string;
  amount: number;
  appliesTo: AttackKind[];
}

export interface MultiattackProfile {
  double: number;
  triple: number;
}

export interface StatusEffect {
  id: string;
  label: string;
  duration: number;
  modifiers?: ScalarModifier[];
  capUp?: DamageCapModifier[];
  supplemental?: SupplementalRule[];
  multiattack?: Partial<MultiattackProfile>;
  defenseDown?: number;
  attackDown?: number;
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
  attack: number;
  modifiers: ScalarModifier[];
  critical: CriticalRule[];
  capUp: DamageCapModifier[];
  supplemental: SupplementalRule[];
}

export interface Enemy {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  chargeDiamonds: number;
  maxChargeDiamonds: number;
  mode: "normal" | "overdrive" | "break";
  modeGauge: number;
  statusEffects: StatusEffect[];
}

export interface BattleState {
  turn: number;
  party: Combatant[];
  enemy: Enemy;
  weaponGrid: WeaponGrid;
  log: BattleLogEntry[];
  chainCount: number;
  lastActionSummary: string;
}

export interface BattleLogEntry {
  id: string;
  turn: number;
  actor: string;
  action: string;
  detail: string;
  damage?: number;
}

export interface DamageContext {
  attacker: Combatant;
  enemy: Enemy;
  weaponGrid: WeaponGrid;
  kind: AttackKind;
  hitMultiplier: number;
  cap: number;
  criticalSeed: number;
}

export interface DamageBreakdown {
  baseDamage: number;
  preCapDamage: number;
  cappedDamage: number;
  finalDamage: number;
  supplementalDamage: number;
  bonusDamage: number;
  criticalMultiplier: number;
  cap: number;
  hitCount: number;
  notes: string[];
}
