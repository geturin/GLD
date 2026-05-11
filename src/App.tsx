import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  Gem,
  Map,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import { attackTurn, executeSkill } from "./game/battleEngine";
import {
  type GameDataSets,
  createDefaultDataSets,
  createInitialBattleState,
} from "./game/demoState";
import { describeSkill } from "./game/skillText";
import {
  MAINHAND_SLOT_COUNT,
  recomputeWeaponGrid,
} from "./game/weaponGrid";
import type {
  AttackKind,
  BattleSourceMotion,
  BattleLogEntry,
  Combatant,
  Enemy,
  ModifierBucket,
  StatusEffect,
  WeaponDefinition,
} from "./game/types";
import { t } from "./i18n/zhCN";

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function hpPercent(current: number, max: number) {
  return `${Math.max(0, Math.min(100, (current / max) * 100))}%`;
}

function spriteAlt(name: string) {
  return formatTemplate(t.battleScene.spriteAlt, { name });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentValue(value: number) {
  return Math.round(value * 100);
}

function formatPercent(current: number, max: number) {
  return `${Math.round(Math.max(0, Math.min(100, (current / max) * 100)))}%`;
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function statusDetails(effect: StatusEffect) {
  const details = [
    ...(effect.attackDown
      ? [formatTemplate(t.status.attackDown, { value: `${percentValue(effect.attackDown)}%` })]
      : []),
    ...(effect.defenseDown
      ? [formatTemplate(t.status.defenseDown, { value: `${percentValue(effect.defenseDown)}%` })]
      : []),
    ...(effect.defenseUp
      ? [formatTemplate(t.status.defenseUp, { value: `${percentValue(effect.defenseUp)}%` })]
      : []),
    ...(effect.damageCut
      ? [formatTemplate(t.status.damageCut, { value: `${percentValue(effect.damageCut)}%` })]
      : []),
    ...(effect.damageReduction
      ? [formatTemplate(t.status.damageReduction, { value: `${percentValue(effect.damageReduction)}%` })]
      : []),
    ...(effect.modifiers ?? []).map((modifier) =>
      formatTemplate(t.status.modifier, {
        label: modifier.label,
        value: `${percentValue(modifier.value)}%`,
      }),
    ),
    ...(effect.capUp ?? []).map((cap) =>
      formatTemplate(t.status.capUp, {
        label: cap.label,
        value: `${percentValue(cap.value)}%`,
      }),
    ),
    ...(effect.supplemental ?? []).map((rule) =>
      formatTemplate(t.status.supplemental, {
        label: rule.label,
        value: formatNumber(rule.amount),
      }),
    ),
    ...(effect.multiattack?.double
      ? [
          formatTemplate(t.status.multiattackDouble, {
            value: `${percentValue(effect.multiattack.double)}%`,
          }),
        ]
      : []),
    ...(effect.multiattack?.triple
      ? [
          formatTemplate(t.status.multiattackTriple, {
            value: `${percentValue(effect.multiattack.triple)}%`,
          }),
        ]
      : []),
  ];

  return details.join(" / ");
}

function statusTone(effect: StatusEffect) {
  const hasDebuff = Boolean(effect.attackDown || effect.defenseDown);
  const hasBuff = Boolean(
    effect.modifiers?.length ||
      effect.capUp?.length ||
      effect.supplemental?.length ||
      effect.multiattack?.double ||
      effect.multiattack?.triple ||
      effect.defenseUp ||
      effect.damageCut ||
      effect.damageReduction,
  );

  if (hasBuff && hasDebuff) {
    return "mixed";
  }

  return hasDebuff ? "debuff" : "buff";
}

function StatusList({
  effects,
  emptyText,
  title,
}: {
  effects: StatusEffect[];
  emptyText: string;
  title: string;
}) {
  return (
    <section className="status-panel">
      <h3>{title}</h3>
      {effects.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {effects.map((effect) => (
            <li className={statusTone(effect)} key={`${effect.id}-${effect.duration}`}>
              <span>
                <strong>{effect.label}</strong>
                <span className="status-meta">
                  <b>{t.status[statusTone(effect)]}</b>
                  <em>
                    {formatTemplate(t.battle.remainingTurns, {
                      turns: effect.duration,
                    })}
                  </em>
                </span>
              </span>
              <small>{statusDetails(effect)}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FieldGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="tuning-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function NumberControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max?: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(readNumber(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function RangeControl({
  label,
  max,
  min = 0,
  onChange,
  step = 1,
  suffix = "%",
  value,
}: {
  label: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="range-control">
      <span>
        {label} <strong>{suffix === "" ? formatNumber(value) : `${value}${suffix}`}</strong>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(readNumber(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

type DataEditorKind =
  | "weapons"
  | "characters"
  | "enemies"
  | "weaponGridTemplates"
  | "statusEffectTaxonomy";

const editorKinds: DataEditorKind[] = [
  "weapons",
  "characters",
  "enemies",
  "weaponGridTemplates",
  "statusEffectTaxonomy",
];
const documentEditorKinds = new Set<DataEditorKind>(["statusEffectTaxonomy"]);

function isDocumentEditorKind(kind: DataEditorKind): kind is "statusEffectTaxonomy" {
  return documentEditorKinds.has(kind);
}

interface BattleFeedback {
  id: number;
  kind: "damage" | "buff" | "debuff";
  targetId?: string;
  targetType?: "enemy" | "party";
  sourceId?: string;
  sourceType?: "enemy" | "party";
  sourceMotion?: BattleSourceMotion;
  hitDamages: number[];
}

type BattleFeedbackKind = BattleFeedback["kind"];

function createBlankWeapon(): WeaponDefinition {
  return {
    id: `weapon-${Date.now()}`,
    name: "新武器",
    series: "自定义",
    weaponType: "sword",
    attack: 1000,
    hp: 100,
    skills: [],
  };
}

function createBlankCharacter(): Combatant {
  return {
    id: `character-${Date.now()}`,
    name: "新角色",
    role: "自定义角色",
    spriteUrl: "/assets/characters/split-transparent/char_01/idle.png",
    spriteSet: {
      idle: "/assets/characters/split-transparent/char_01/idle.png",
      walk1: "/assets/characters/split-transparent/char_01/walk_1.png",
      walk2: "/assets/characters/split-transparent/char_01/walk_2.png",
      attack: "/assets/characters/split-transparent/char_01/attack.png",
      hurt: "/assets/characters/split-transparent/char_01/hurt.png",
      skill: "/assets/characters/split-transparent/char_01/skill.png",
      victory: "/assets/characters/split-transparent/char_01/victory.png",
    },
    maxHp: 10000,
    hp: 10000,
    baseAttack: 8000,
    chargeBar: 0,
    multiattack: { double: 0.1, triple: 0.03 },
    chargeAttack: {
      label: "奥义",
      multiplier: 4.5,
      cap: 1685000,
      fixedDamage: 0,
    },
    skills: [],
    personalModifiers: [],
    critical: [],
    bonusDamage: [],
    supplemental: [],
    capUp: [],
    statusEffects: [],
  };
}

function createBlankEnemy(): Enemy {
  return {
    id: `enemy-${Date.now()}`,
    name: "新怪物",
    spriteUrl: "/assets/enemies/foundry-warden-pixel.svg",
    maxHp: 1000000,
    hp: 1000000,
    attack: 5000,
    defense: 10,
    chargeDiamonds: 0,
    maxChargeDiamonds: 3,
    mode: "normal",
    modeGauge: 1,
    debuffResistance: 0.1,
    statusEffects: [],
    triggers: [],
    triggeredIds: [],
  };
}

function createBlankWeaponGridTemplate() {
  return {
    id: `grid-${Date.now()}`,
    name: "新武器盘",
    mainhands: [null, null, null, null],
    subSlots: Array.from({ length: 9 }, () => null),
  };
}

function itemName(item: { id: string; name: string }) {
  return `${item.name} (${item.id})`;
}

async function persistDataSet(kind: DataEditorKind, data: unknown) {
  const response = await fetch(`/api/data/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "服务器保存失败。");
  }
}

export function App() {
  const [dataSets, setDataSets] = useState(createDefaultDataSets);
  const [battle, setBattle] = useState(() => createInitialBattleState(dataSets));
  const [battleFeedback, setBattleFeedback] = useState<BattleFeedback | null>(null);
  const [battleFeedbackQueue, setBattleFeedbackQueue] = useState<BattleFeedback[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState(battle.party[0].id);
  const [selectedEnemyId, setSelectedEnemyId] = useState(battle.enemy.id);
  const [editorKind, setEditorKind] = useState<DataEditorKind>("weapons");
  const [editorId, setEditorId] = useState(dataSets.weapons[0]?.id ?? "");
  const [editorDraft, setEditorDraft] = useState(() =>
    JSON.stringify(dataSets.weapons[0] ?? createBlankWeapon(), null, 2),
  );
  const [editorError, setEditorError] = useState("");

  const selectedMember =
    battle.party.find((member) => member.id === selectedMemberId) ?? battle.party[0];
  const selectedEnemy = battle.enemy;
  const enemyHpRate = hpPercent(battle.enemy.hp, battle.enemy.maxHp);
  const effectiveMaxHp = selectedMember.maxHp + battle.weaponGrid.hp;

  useEffect(() => {
    if (!battleFeedback) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setBattleFeedbackQueue((queue) => {
        const [nextFeedback, ...remaining] = queue;
        setBattleFeedback(nextFeedback ?? null);
        return remaining;
      });
    }, 1050);
    return () => window.clearTimeout(timeout);
  }, [battleFeedback]);

  function feedbacksFromLogs(logs: BattleLogEntry[]) {
    const now = Date.now();
    return logs
      .filter((entry) => entry.feedback)
      .map((entry, index) => {
        const kind: BattleFeedbackKind =
          entry.feedback === "debuff" ? "debuff" : entry.feedback === "buff" ? "buff" : "damage";
        return {
          id: now + index,
          kind,
          targetId: entry.targetId,
          targetType: entry.targetType,
          sourceId: entry.sourceId,
          sourceType: entry.sourceType,
          sourceMotion: entry.sourceMotion,
          hitDamages: entry.hitDamages ?? [],
        };
      });
  }

  function playFeedbacks(feedbacks: BattleFeedback[]) {
    const [firstFeedback, ...remaining] = feedbacks;
    setBattleFeedback(firstFeedback ?? null);
    setBattleFeedbackQueue(remaining);
  }

  function playResetFeedbacks() {
    setBattleFeedback(null);
    setBattleFeedbackQueue([]);
  }

  function applyBattleAction(action: (current: typeof battle) => typeof battle) {
    setBattle((current) => {
      const next = action(current);
      playFeedbacks(feedbacksFromLogs(next.log.slice(current.log.length)));
      return next;
    });
  }

  function memberSprite(member: Combatant) {
    if (battle.enemy.hp <= 0 && member.spriteSet?.victory) {
      return member.spriteSet.victory;
    }

    if (battleFeedback?.targetType === "party" && battleFeedback.targetId === member.id) {
      if (battleFeedback.kind === "damage") {
        return member.spriteSet?.hurt ?? member.spriteUrl;
      }
      return member.spriteSet?.skill ?? member.spriteUrl;
    }

    if (battleFeedback?.sourceType === "party" && battleFeedback.sourceId === member.id) {
      return member.spriteSet?.[battleFeedback.sourceMotion ?? "attack"] ?? member.spriteUrl;
    }

    return member.spriteSet?.idle ?? member.spriteUrl;
  }

  function updateSelectedMember(updater: (member: Combatant) => Combatant) {
    setBattle((current) => ({
      ...current,
      party: current.party.map((member) =>
        member.id === selectedMember.id ? updater(member) : member,
      ),
      lastActionSummary: `${selectedMember.name}${t.battle.statsAdjusted}`,
    }));
  }

  function setSelectedBaseAttack(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      baseAttack: clamp(Math.round(value), 1, 999999),
    }));
  }

  function setSelectedMaxHp(value: number) {
    updateSelectedMember((member) => {
      const maxHp = clamp(Math.round(value), 1, 999999);
      return {
        ...member,
        maxHp,
        hp: clamp(member.hp, 0, maxHp + battle.weaponGrid.hp),
      };
    });
  }

  function setSelectedHp(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      hp: clamp(Math.round(value), 0, member.maxHp + battle.weaponGrid.hp),
    }));
  }

  function setSelectedChargeBar(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      chargeBar: clamp(Math.round(value), 0, 100),
    }));
  }

  function setSelectedMultiattack(kind: "double" | "triple", value: number) {
    updateSelectedMember((member) => ({
      ...member,
      multiattack: {
        ...member.multiattack,
        [kind]: clamp(value / 100, 0, 1),
      },
    }));
  }

  function updateGridModifier(id: string, bucket: ModifierBucket, value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        modifiers: current.weaponGrid.modifiers.some((modifier) => modifier.id === id)
          ? current.weaponGrid.modifiers.map((modifier) =>
              modifier.id === id ? { ...modifier, bucket, value: value / 100 } : modifier,
            )
          : [
              ...current.weaponGrid.modifiers,
              { id, label: id, bucket, value: value / 100 },
            ],
      },
      lastActionSummary: t.battle.weaponSkillAdjusted,
    }));
  }

  function updatePersonalModifier(id: string, bucket: ModifierBucket, value: number) {
    updateSelectedMember((member) => ({
      ...member,
      personalModifiers: member.personalModifiers.map((modifier) =>
        modifier.id === id ? { ...modifier, bucket, value: value / 100 } : modifier,
      ),
    }));
  }

  function updateWeaponCap(id: string, appliesTo: AttackKind[], value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        capUp: current.weaponGrid.capUp.some((cap) => cap.id === id)
          ? current.weaponGrid.capUp.map((cap) =>
              cap.id === id ? { ...cap, appliesTo, value: value / 100 } : cap,
            )
          : [
              ...current.weaponGrid.capUp,
              { id, label: id, source: "weapon", appliesTo, value: value / 100 },
            ],
      },
      lastActionSummary: t.battle.capAdjusted,
    }));
  }

  function updateSupplemental(id: string, appliesTo: AttackKind[], value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        supplemental: current.weaponGrid.supplemental.some((rule) => rule.id === id)
          ? current.weaponGrid.supplemental.map((rule) =>
              rule.id === id ? { ...rule, appliesTo, amount: Math.round(value) } : rule,
            )
          : [
              ...current.weaponGrid.supplemental,
              {
                id,
                label: id,
                appliesTo,
                amount: Math.round(value),
                condition: "always",
                sourceType: "weapon",
              },
            ],
      },
      lastActionSummary: t.battle.supplementalAdjusted,
    }));
  }

  function updateCritical(field: "chance" | "damage", value: number) {
    setBattle((current) => ({
      ...current,
      weaponGrid: {
        ...current.weaponGrid,
        critical: current.weaponGrid.critical.some((rule) => rule.id === "demo-crit")
          ? current.weaponGrid.critical.map((rule) =>
              rule.id === "demo-crit" ? { ...rule, [field]: value / 100 } : rule,
            )
          : [
              ...current.weaponGrid.critical,
              {
                id: "demo-crit",
                label: t.demo.labels.demoCritical,
                chance: field === "chance" ? value / 100 : 0,
                damage: field === "damage" ? value / 100 : 0.5,
              },
            ],
      },
      lastActionSummary: t.battle.criticalAdjusted,
    }));
  }

  function updateBonusDamage(value: number) {
    updateSelectedMember((member) => ({
      ...member,
      bonusDamage: member.bonusDamage.map((rule) =>
        rule.id === "normal-echo" ? { ...rule, multiplier: value / 100 } : rule,
      ),
    }));
  }

  const gridModifier = (id: string) =>
    percentValue(battle.weaponGrid.modifiers.find((modifier) => modifier.id === id)?.value ?? 0);
  const personalModifier = (id: string) =>
    percentValue(selectedMember.personalModifiers.find((modifier) => modifier.id === id)?.value ?? 0);
  const capModifier = (id: string) =>
    percentValue(battle.weaponGrid.capUp.find((cap) => cap.id === id)?.value ?? 0);
  const supplemental = (id: string) =>
    battle.weaponGrid.supplemental.find((rule) => rule.id === id)?.amount ?? 0;
  const critical = battle.weaponGrid.critical.find((rule) => rule.id === "demo-crit");
  const bonusDamage = percentValue(
    selectedMember.bonusDamage.find((rule) => rule.id === "normal-echo")?.multiplier ?? 0,
  );
  const activeMainhands = Math.min(MAINHAND_SLOT_COUNT, battle.party.length);
  const isDocumentEditor = isDocumentEditorKind(editorKind);
  const editorItems = isDocumentEditor
    ? [{ id: editorKind, name: t.dataEditor.kinds[editorKind] }]
    : (dataSets[editorKind] as Array<{ id: string; name: string }>);

  function resetBattle(nextDataSets = dataSets) {
    const nextBattle = createInitialBattleState(nextDataSets);
    setBattle(nextBattle);
    playResetFeedbacks();
    setSelectedMemberId(nextBattle.party[0]?.id ?? "");
    setSelectedEnemyId(nextBattle.enemy.id);
  }

  function selectEditorItem(kind: DataEditorKind, id: string) {
    if (isDocumentEditorKind(kind)) {
      setEditorKind(kind);
      setEditorId(kind);
      setEditorDraft(JSON.stringify(dataSets[kind], null, 2));
      setEditorError("");
      return;
    }

    const items = dataSets[kind] as Array<{ id: string; name: string }>;
    const item = items.find((candidate) => candidate.id === id) ?? items[0];
    setEditorKind(kind);
    setEditorId(item?.id ?? "");
    setEditorDraft(JSON.stringify(item ?? {}, null, 2));
    setEditorError("");
  }

  async function saveEditorDraft() {
    try {
      const parsed = JSON.parse(editorDraft) as { id?: string; name?: string };

      if (isDocumentEditorKind(editorKind)) {
        const nextDataSets = structuredClone(dataSets);
        nextDataSets.statusEffectTaxonomy = parsed as typeof nextDataSets.statusEffectTaxonomy;
        await persistDataSet(editorKind, parsed);
        setDataSets(nextDataSets);
        setEditorDraft(JSON.stringify(parsed, null, 2));
        setEditorError("");
        return;
      }

      if (!parsed.id || !parsed.name) {
        throw new Error("数据必须包含 id 和 name。");
      }

      const nextDataSets = structuredClone(dataSets);
      const items = nextDataSets[editorKind] as Array<{ id: string; name: string }>;
      const existingIndex = items.findIndex((item) => item.id === editorId);

      if (existingIndex >= 0) {
        items[existingIndex] = parsed as { id: string; name: string };
      } else {
        items.push(parsed as { id: string; name: string });
      }

      await persistDataSet(editorKind, items);
      setDataSets(nextDataSets);
      setEditorId(parsed.id);
      setEditorDraft(JSON.stringify(parsed, null, 2));
      setEditorError("");
      resetBattle(nextDataSets);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "JSON 格式错误。");
    }
  }

  function addEditorItem() {
    if (isDocumentEditorKind(editorKind)) {
      setEditorDraft(JSON.stringify(dataSets[editorKind], null, 2));
      setEditorError("整份管理表不能新增条目，请直接编辑 JSON 内容。");
      return;
    }

    const item =
      editorKind === "weapons"
        ? createBlankWeapon()
        : editorKind === "characters"
          ? createBlankCharacter()
          : editorKind === "enemies"
            ? createBlankEnemy()
            : createBlankWeaponGridTemplate();
    const nextDataSets = structuredClone(dataSets);
    (nextDataSets[editorKind] as Array<{ id: string; name: string }>).push(item);
    setDataSets(nextDataSets);
    setEditorId(item.id);
    setEditorDraft(JSON.stringify(item, null, 2));
    setEditorError("");
  }

  function equipWeapon(slotType: "mainhand" | "sub", index: number, weaponId: string) {
    setBattle((current) => {
      const nextGrid = structuredClone(current.weaponGrid);
      const slot = weaponId ? { weaponId } : null;

      if (slotType === "mainhand") {
        nextGrid.mainhands[index] = slot;
      } else {
        nextGrid.subSlots[index] = slot;
      }

      return {
        ...current,
        weaponGrid: recomputeWeaponGrid(nextGrid, current.party.length, dataSets.weapons),
        lastActionSummary: `${t.panels.weaponGrid}已更新`,
      };
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.app.eyebrow}</p>
          <h1>{t.app.title}</h1>
        </div>
        <nav className="mode-tabs" aria-label="游戏模式">
          <button type="button">
            <Map size={18} />
            {t.nav.dungeon}
          </button>
          <button className="active" type="button">
            <Swords size={18} />
            {t.nav.battle}
          </button>
          <button type="button">
            <Gem size={18} />
            {t.nav.grid}
          </button>
        </nav>
      </header>

      <section className="combat-layout" aria-label="GBF-like 战斗原型">
        <aside className="panel party-panel">
          <div className="panel-heading">
            <Shield size={18} />
            <h2>{t.panels.party}</h2>
          </div>
          <div className="party-list">
            {battle.party.map((member) => (
              <button
                className={`party-card selectable ${member.id === selectedMember.id ? "selected" : ""}`}
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                type="button"
              >
                {memberSprite(member) ? (
                  <img
                    alt={spriteAlt(member.name)}
                    className="party-card-sprite"
                    src={memberSprite(member)}
                  />
                ) : null}
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
                <span className="charge-pill">{member.chargeBar}% CA</span>
                <span className="bar">
                  <i style={{ width: hpPercent(member.hp, member.maxHp) }} />
                </span>
                  <span className="stat-row">
                  <small>{t.battle.hp} {formatNumber(member.hp)} / {formatNumber(member.maxHp + battle.weaponGrid.hp)}</small>
                  <small>{t.battle.advantage}</small>
                </span>
              </button>
            ))}
          </div>

          <StatusList
            effects={selectedMember.statusEffects}
            emptyText={t.battle.noStatusEffects}
            title={t.panels.statusEffects}
          />

          <section className="stat-dashboard" aria-label={`${selectedMember.name}${t.panels.damageLab}`}>
            <div className="section-title compact-title">
              <Activity size={18} />
              <h2>{t.panels.damageLab}</h2>
            </div>

            <FieldGroup title={t.groups.base}>
              <NumberControl label={t.controls.characterAttack} min={1} onChange={setSelectedBaseAttack} step={100} value={selectedMember.baseAttack} />
              <NumberControl label={t.controls.weaponAttack} min={0} onChange={() => undefined} step={100} value={battle.weaponGrid.attack} />
              <NumberControl label={t.controls.weaponHp} min={0} onChange={() => undefined} step={100} value={battle.weaponGrid.hp} />
              <NumberControl label={t.controls.maxHp} min={1} onChange={setSelectedMaxHp} step={100} value={selectedMember.maxHp} />
              <RangeControl label={t.controls.currentHp} max={effectiveMaxHp} onChange={setSelectedHp} step={100} suffix="" value={selectedMember.hp} />
              <RangeControl label={t.controls.chargeBar} max={100} onChange={setSelectedChargeBar} step={5} value={selectedMember.chargeBar} />
              <RangeControl label={t.controls.doubleAttack} max={100} onChange={(value) => setSelectedMultiattack("double", value)} value={Math.round(selectedMember.multiattack.double * 100)} />
              <RangeControl label={t.controls.tripleAttack} max={100} onChange={(value) => setSelectedMultiattack("triple", value)} value={Math.round(selectedMember.multiattack.triple * 100)} />
              <label className="toggle-control">
                <span>{t.controls.randomVariance}</span>
                <input
                  checked={battle.options.randomVariance}
                  onChange={(event) =>
                    setBattle((current) => ({
                      ...current,
                      options: { ...current.options, randomVariance: event.target.checked },
                    }))
                  }
                  type="checkbox"
                />
              </label>
            </FieldGroup>

            <FieldGroup title={t.groups.attackBuckets}>
              <RangeControl label={t.controls.normalAttack} max={500} onChange={(value) => updateGridModifier("normal-atk", "normal", value)} value={gridModifier("normal-atk")} />
              <RangeControl label={t.controls.omegaAttack} max={500} onChange={(value) => updateGridModifier("omega-atk", "omega", value)} value={gridModifier("omega-atk")} />
              <RangeControl label={t.controls.exAttack} max={300} onChange={(value) => updateGridModifier("ex-atk", "ex", value)} value={gridModifier("ex-atk")} />
              <RangeControl label={t.controls.uniqueAttack} max={200} onChange={(value) => updatePersonalModifier("unique-passive", "unique", value)} value={personalModifier("unique-passive")} />
              <RangeControl label={t.controls.seraphic} max={30} onChange={(value) => updatePersonalModifier("seraphic-passive", "seraphic", value)} value={personalModifier("seraphic-passive")} />
              <RangeControl label={t.controls.damageAmplified} max={50} onChange={(value) => updateGridModifier("amplified-dmg", "amplified", value)} value={gridModifier("amplified-dmg")} />
            </FieldGroup>

            <FieldGroup title={t.groups.hpConditional}>
              <RangeControl label={t.controls.stamina} max={100} onChange={(value) => updateGridModifier("stamina-atk", "stamina", value)} value={gridModifier("stamina-atk")} />
              <RangeControl label={t.controls.enmity} max={100} onChange={(value) => updateGridModifier("enmity-atk", "enmity", value)} value={gridModifier("enmity-atk")} />
            </FieldGroup>

            <FieldGroup title={t.groups.damageType}>
              <RangeControl label={t.controls.skillDamage} max={300} onChange={(value) => updateGridModifier("skill-dmg", "skillDamage", value)} value={gridModifier("skill-dmg")} />
              <RangeControl label={t.controls.chargeAttackDamage} max={300} onChange={(value) => updateGridModifier("ca-dmg", "caDamage", value)} value={gridModifier("ca-dmg")} />
              <RangeControl label={t.controls.bonusDamage} max={100} onChange={updateBonusDamage} value={bonusDamage} />
            </FieldGroup>

            <FieldGroup title={t.groups.damageCap}>
              <RangeControl label={t.controls.normalCap} max={20} onChange={(value) => updateWeaponCap("normal-cap-up", ["normal", "counter"], value)} value={capModifier("normal-cap-up")} />
              <RangeControl label={t.controls.skillCap} max={20} onChange={(value) => updateWeaponCap("skill-cap-up", ["skill"], value)} value={capModifier("skill-cap-up")} />
              <RangeControl label={t.controls.chargeAttackCap} max={20} onChange={(value) => updateWeaponCap("ca-cap-up", ["charge"], value)} value={capModifier("ca-cap-up")} />
            </FieldGroup>

            <FieldGroup title={t.groups.criticalSupplemental}>
              <RangeControl label={t.controls.criticalRate} max={100} onChange={(value) => updateCritical("chance", value)} value={percentValue(critical?.chance ?? 0)} />
              <RangeControl label={t.controls.criticalDamage} max={200} onChange={(value) => updateCritical("damage", value)} value={percentValue(critical?.damage ?? 0)} />
              <NumberControl label={t.controls.normalSupplemental} min={0} onChange={(value) => updateSupplemental("normal-supp", ["normal", "counter"], value)} step={10000} value={supplemental("normal-supp")} />
              <NumberControl label={t.controls.skillSupplemental} min={0} onChange={(value) => updateSupplemental("skill-supp", ["skill"], value)} step={10000} value={supplemental("skill-supp")} />
              <NumberControl label={t.controls.chargeAttackSupplemental} min={0} onChange={(value) => updateSupplemental("ca-supp", ["charge"], value)} step={10000} value={supplemental("ca-supp")} />
            </FieldGroup>
          </section>
        </aside>

        <section className="battle-stage" aria-label={t.battleScene.aria}>
          <section className="dungeon-battle-screen" aria-label={t.battleScene.field}>
            <div className="screen-corner top-left" />
            <div className="screen-corner top-right" />
            <div className="screen-corner bottom-left" />
            <div className="screen-corner bottom-right" />

            <button
              className={`enemy-overview ${battle.enemy.id === selectedEnemyId ? "selected" : ""}`}
              aria-label={t.battleScene.enemyStatus}
              onClick={() => setSelectedEnemyId(battle.enemy.id)}
              type="button"
            >
              <div>
                <strong>{battle.enemy.name}</strong>
                <small>{t.battleScene.mode} {battle.enemy.mode} / {t.battleScene.ct}</small>
              </div>
              <div className="enemy-mini-hp">
                <span>
                  {formatNumber(battle.enemy.hp)} / {formatNumber(battle.enemy.maxHp)} ({formatPercent(battle.enemy.hp, battle.enemy.maxHp)})
                </span>
                <i style={{ width: enemyHpRate }} />
              </div>
              <div className="charge-diamonds" aria-label={t.battle.chargeDiamond}>
                {Array.from({ length: battle.enemy.maxChargeDiamonds }, (_, index) => (
                  <i
                    className={index < battle.enemy.chargeDiamonds ? "filled" : ""}
                    key={`diamond-${index}`}
                  />
                ))}
              </div>
            </button>

            <button
              className={`enemy-stage ${
                battleFeedback?.targetType === "enemy" && battleFeedback.targetId === battle.enemy.id
                  ? battleFeedback.kind
                  : ""
              } ${battle.enemy.id === selectedEnemyId ? "selected" : ""}`}
              key={`enemy-feedback-${battleFeedback?.targetType === "enemy" ? battleFeedback.id : "idle"}`}
              onClick={() => setSelectedEnemyId(battle.enemy.id)}
              type="button"
              aria-label={battle.enemy.name}
            >
              <div className="enemy-shadow" />
              {battle.enemy.spriteUrl ? (
                <img
                  alt={spriteAlt(battle.enemy.name)}
                  className="dungeon-enemy-sprite"
                  src={battle.enemy.spriteUrl}
                />
              ) : null}
              {battleFeedback?.targetType === "enemy" && battleFeedback.targetId === battle.enemy.id ? (
                <div className="floating-damage-layer">
                  {battleFeedback.hitDamages.map((damage, index) => (
                    <span
                      key={`${battleFeedback.id}-${index}`}
                      style={{ "--hit-index": index } as CSSProperties}
                    >
                      {formatNumber(damage)}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>

            <details className="enemy-status-drawer">
              <summary>{selectedEnemy.name} {t.panels.statusEffects}</summary>
              <StatusList
                effects={selectedEnemy.statusEffects}
                emptyText={t.battle.noStatusEffects}
                title={`${selectedEnemy.name} ${t.panels.statusEffects}`}
              />
            </details>

            <div className="party-window">
              {battle.party.map((member) => (
                <button
                  className={`party-command-card ${member.id === selectedMember.id ? "selected" : ""} ${
                    battleFeedback?.targetType === "party" && battleFeedback.targetId === member.id
                      ? battleFeedback.kind
                      : ""
                  } ${
                    battleFeedback?.sourceType === "party" && battleFeedback.sourceId === member.id
                      ? `acting ${battleFeedback.sourceMotion ?? "attack"}`
                      : ""
                  }`}
                  key={member.id}
                  onClick={() => setSelectedMemberId(member.id)}
                  type="button"
                >
                  {memberSprite(member) ? (
                    <img alt={spriteAlt(member.name)} src={memberSprite(member)} />
                  ) : null}
                  <strong>{member.name}</strong>
                  <span>
                    {formatNumber(member.hp)} / {formatNumber(member.maxHp + battle.weaponGrid.hp)}
                    <small>{formatPercent(member.hp, member.maxHp + battle.weaponGrid.hp)}</small>
                    <b>CA {member.chargeBar}%</b>
                  </span>
                  <i style={{ width: hpPercent(member.hp, member.maxHp + battle.weaponGrid.hp) }} />
                  {battleFeedback?.targetType === "party" && battleFeedback.targetId === member.id ? (
                    <span className="card-floating-damage">
                      {battleFeedback.hitDamages.map((damage, index) => (
                        <b
                          key={`${battleFeedback.id}-${member.id}-${index}`}
                          style={{ "--hit-index": index } as CSSProperties}
                        >
                          {formatNumber(damage)}
                        </b>
                      ))}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="skill-command-window" aria-label={`${selectedMember.name}${t.panels.skills}`}>
              <header>
                <strong>{selectedMember.name}</strong>
                <span>{t.battleScene.skillPanel}</span>
              </header>
              <div className="compact-skill-grid">
                {selectedMember.skills.map((skill) => (
                  <button
                    disabled={skill.remainingCooldown > 0}
                    key={skill.id}
                    onClick={() =>
                      applyBattleAction((current) => executeSkill(current, selectedMember.id, skill.id))
                    }
                    title={describeSkill(skill)}
                    type="button"
                  >
                    <strong>{skill.label}</strong>
                    <small>{skill.remainingCooldown > 0 ? `${skill.remainingCooldown}T` : skill.kind}</small>
                  </button>
                ))}
              </div>
              <details className="member-status-drawer">
                <summary>{selectedMember.name} {t.panels.statusEffects}</summary>
                <StatusList
                  effects={selectedMember.statusEffects}
                  emptyText={t.battle.noStatusEffects}
                  title={`${selectedMember.name} ${t.panels.statusEffects}`}
                />
              </details>
            </div>

            <div className="screen-actions">
              <button className="primary-command" onClick={() => applyBattleAction(attackTurn)} type="button">
                <Swords size={18} />
                {t.commands.attackTurn}
              </button>
              <button onClick={() => resetBattle()} type="button">
                <RotateCcw size={16} />
                {t.commands.reset}
              </button>
            </div>

          </section>
        </section>

        <aside className="panel systems-panel">
          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>{t.panels.weaponGrid}</h2>
          </div>
          <section className="weapon-grid-panel">
            <div className="weapon-grid-summary">
              <span>
                {t.weaponGrid.activeSummary.replace("{mainhands}", String(activeMainhands))}
              </span>
              <span>{t.controls.weaponAttack} {formatNumber(battle.weaponGrid.attack)}</span>
              <span>{t.controls.weaponHp} {formatNumber(battle.weaponGrid.hp)}</span>
              <span>{t.controls.skillBoost} {percentValue(battle.weaponGrid.skillBoost)}%</span>
              <span>{t.controls.defenseIgnore} {percentValue(battle.weaponGrid.defenseIgnore)}%</span>
            </div>
            <div className="mainhand-grid">
              {battle.weaponGrid.mainhands.map((slot, index) => {
                const locked = index >= activeMainhands;
                return (
                  <label className={`weapon-slot ${locked ? "locked" : ""}`} key={`main-${index}`}>
                    <span>{t.weaponGrid.mainhand} {index + 1}</span>
                    <select
                      disabled={locked}
                      onChange={(event) => equipWeapon("mainhand", index, event.target.value)}
                      value={slot?.weaponId ?? ""}
                    >
                      <option value="">{locked ? t.weaponGrid.locked : t.weaponGrid.empty}</option>
                      {dataSets.weapons.map((weapon) => (
                        <option key={weapon.id} value={weapon.id}>
                          {weapon.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="sub-weapon-grid">
              {battle.weaponGrid.subSlots.map((slot, index) => (
                <label className="weapon-slot" key={`sub-${index}`}>
                  <span>{t.weaponGrid.subSlot} {index + 1}</span>
                  <select
                    onChange={(event) => equipWeapon("sub", index, event.target.value)}
                    value={slot?.weaponId ?? ""}
                  >
                    <option value="">{t.weaponGrid.empty}</option>
                    {dataSets.weapons.map((weapon) => (
                      <option key={weapon.id} value={weapon.id}>
                        {weapon.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <ul className="weapon-skill-list">
              {dataSets.weapons.map((weapon) => (
                <li key={weapon.id}>
                  <strong>{weapon.name}</strong>
                  <small>{weapon.series} / {weapon.skills.map((skill) => skill.label).join("、")}</small>
                </li>
              ))}
            </ul>
          </section>

          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>{t.panels.dataEditor}</h2>
          </div>
          <section className="data-editor">
            <div className="editor-toolbar">
              <select
                onChange={(event) =>
                  selectEditorItem(event.target.value as DataEditorKind, "")
                }
                value={editorKind}
              >
                {editorKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t.dataEditor.kinds[kind]}
                  </option>
                ))}
              </select>
              <select
                onChange={(event) => selectEditorItem(editorKind, event.target.value)}
                value={editorId}
              >
                {editorItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {itemName(item)}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              spellCheck={false}
              onChange={(event) => setEditorDraft(event.target.value)}
              value={editorDraft}
            />
            {editorError ? <p className="editor-error">{editorError}</p> : null}
            <div className="editor-actions">
              <button onClick={saveEditorDraft} type="button">
                {t.dataEditor.save}
              </button>
              <button onClick={addEditorItem} type="button">
                {t.dataEditor.add}
              </button>
            </div>
            <p className="editor-note">{t.dataEditor.note}</p>
          </section>

          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>{t.panels.systems}</h2>
          </div>
          <ul className="system-list compact">
            {t.systems.map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
          <div className="formula-card">
            <h3>{t.formula.title}</h3>
            <p>{t.formula.description}</p>
          </div>
        </aside>
      </section>

      <section className="log-dock" aria-label={t.panels.battleLog}>
        <div className="section-title">
          <Activity size={18} />
          <h2>{battle.lastActionSummary}</h2>
        </div>
        <ol>
          {battle.log
            .slice()
            .reverse()
            .slice(0, 10)
            .map((entry) => (
              <li key={entry.id}>
                <span>{t.battle.turn}{entry.turn}</span>
                <strong>{entry.actor}</strong>
                <em>{entry.action}</em>
                <p>{entry.detail}</p>
              </li>
            ))}
        </ol>
      </section>
    </main>
  );
}
