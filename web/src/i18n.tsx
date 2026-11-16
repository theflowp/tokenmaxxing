import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nProvider as LensoI18nProvider } from "@lenso/ui";
import { createFormatters, type Formatters } from "./format";

export const LANGUAGES = [
  { value: "fr", label: "Français", locale: "fr-FR" },
  { value: "en", label: "English", locale: "en-US" },
  { value: "zh", label: "中文", locale: "zh-CN" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["value"];

const FALLBACK: Lang = "en";
const STORAGE_KEY = "tm.lang";

const fr = {
  allAgents: "Tous les agents",
  agent: "Agent",
  period: "Période",
  metric: "Mesure",
  days: (n: number) => `${n} jours`,
  allTime: "Tout",
  cost: "Coût",
  tokens: "Tokens",

  error: (msg: string) => `Erreur : ${msg}`,
  syncFailed: (msg: string) => `Synchro ccusage en échec : ${msg}`,
  firstSync: "Première synchronisation avec ccusage en cours…",
  noData: "Aucune donnée. Lance une synchronisation.",

  localData: "Données locales via ccusage",
  syncing: "synchro en cours…",
  syncedJustNow: "synchro à l'instant",
  syncedAgo: (ago: string) => `synchro ${ago}`,
  neverSynced: "jamais synchronisé",
  historySince: (date: string) => `historique depuis le ${date}`,
  syncNow: "Synchroniser maintenant",
  syncInProgress: "Synchronisation…",
  syncAction: "Synchroniser avec ccusage",
  language: "Langue",
  sourceCode: "Code source sur GitHub",

  sessions: (n: string) => `${n} sessions`,
  apiEstimate: "estimation au prix API",
  atApiPrice: (amount: string) => `${amount} au prix API`,
  shareOfCost: (p: string) => `${p} du coût`,
  shareOfVolume: (p: string) => `${p} du volume`,
  tokenCount: (v: string) => `${v} tokens`,

  costPerDay: "Coût par jour",
  tokensPerDay: "Tokens par jour",
  total: "Total",

  totals: "Totaux",
  processedTokens: "Tokens traités",
  cacheRead: "Lecture cache",
  cacheWrite: "Écriture cache",
  uncachedInput: "Input hors cache",
  input: "Input",
  output: "Output",
  cacheSavings: "Économie du cache",

  costByType: "Coût par type (estimé)",
  tokensByType: "Tokens par type",
  costByAgent: "Coût par agent",
  tokensByAgent: "Tokens par agent",
  activeDays: (n: string) => `${n} jours actifs`,

  breakdown: "Détail",
  groupBy: "Grouper par",
  model: "Modèle",
  day: "Jour",
  share: "Part",
  byModel: "Répartition par modèle",
  byDay: "Répartition par jour",
  shareOf: (name: string) => `Part de ${name}`,
};

export type Messages = typeof fr;

const en: Messages = {
  allAgents: "All agents",
  agent: "Agent",
  period: "Period",
  metric: "Metric",
  days: (n) => `${n} days`,
  allTime: "All time",
  cost: "Cost",
  tokens: "Tokens",

  error: (msg) => `Error: ${msg}`,
  syncFailed: (msg) => `ccusage sync failed: ${msg}`,
  firstSync: "First sync with ccusage in progress…",
  noData: "No data yet. Run a sync.",

  localData: "Local data via ccusage",
  syncing: "syncing…",
  syncedJustNow: "synced just now",
  syncedAgo: (ago) => `synced ${ago}`,
  neverSynced: "never synced",
  historySince: (date) => `history since ${date}`,
  syncNow: "Sync now",
  syncInProgress: "Syncing…",
  syncAction: "Sync with ccusage",
  language: "Language",
  sourceCode: "Source on GitHub",

  sessions: (n) => `${n} sessions`,
  apiEstimate: "estimated at API prices",
  atApiPrice: (amount) => `${amount} at API prices`,
  shareOfCost: (p) => `${p} of cost`,
  shareOfVolume: (p) => `${p} of volume`,
  tokenCount: (v) => `${v} tokens`,

  costPerDay: "Cost per day",
  tokensPerDay: "Tokens per day",
  total: "Total",

  totals: "Totals",
  processedTokens: "Tokens processed",
  cacheRead: "Cache read",
  cacheWrite: "Cache write",
  uncachedInput: "Uncached input",
  input: "Input",
  output: "Output",
  cacheSavings: "Cache savings",

  costByType: "Cost by type (estimated)",
  tokensByType: "Tokens by type",
  costByAgent: "Cost by agent",
  tokensByAgent: "Tokens by agent",
  activeDays: (n) => `${n} active days`,

  breakdown: "Breakdown",
  groupBy: "Group by",
  model: "Model",
  day: "Day",
  share: "Share",
  byModel: "Breakdown by model",
  byDay: "Breakdown by day",
  shareOf: (name) => `Share of ${name}`,
};

const zh: Messages = {
  allAgents: "全部 Agent",
  agent: "Agent",
  period: "时间范围",
  metric: "指标",
  days: (n) => `${n} 天`,
  allTime: "全部",
  cost: "费用",
  tokens: "Token",

  error: (msg) => `错误：${msg}`,
  syncFailed: (msg) => `ccusage 同步失败：${msg}`,
  firstSync: "正在与 ccusage 进行首次同步…",
  noData: "暂无数据，请先同步。",

  localData: "本地数据，来源 ccusage",
  syncing: "同步中…",
  syncedJustNow: "刚刚同步",
  syncedAgo: (ago) => `${ago}同步`,
  neverSynced: "尚未同步",
  historySince: (date) => `历史记录始于 ${date}`,
  syncNow: "立即同步",
  syncInProgress: "正在同步…",
  syncAction: "与 ccusage 同步",
  language: "语言",
  sourceCode: "GitHub 源代码",

  sessions: (n) => `${n} 个会话`,
  apiEstimate: "按 API 价格估算",
  atApiPrice: (amount) => `按 API 价格计 ${amount}`,
  shareOfCost: (p) => `占费用 ${p}`,
  shareOfVolume: (p) => `占用量 ${p}`,
  tokenCount: (v) => `${v} Token`,

  costPerDay: "每日费用",
  tokensPerDay: "每日 Token",
  total: "合计",

  totals: "汇总",
  processedTokens: "处理的 Token",
  cacheRead: "缓存读取",
  cacheWrite: "缓存写入",
  uncachedInput: "非缓存输入",
  input: "输入",
  output: "输出",
  cacheSavings: "缓存节省",

  costByType: "按类型统计费用（估算）",
  tokensByType: "按类型统计 Token",
  costByAgent: "按 Agent 统计费用",
  tokensByAgent: "按 Agent 统计 Token",
  activeDays: (n) => `${n} 个活跃天`,

  breakdown: "明细",
  groupBy: "分组方式",
  model: "模型",
  day: "日期",
  share: "占比",
  byModel: "按模型明细",
  byDay: "按日明细",
  shareOf: (name) => `${name} 的占比`,
};

const MESSAGES: Record<Lang, Messages> = { fr, en, zh };

const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.value === v);

/** Saved choice first, then the browser's preferred languages, then English. */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return FALLBACK;
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Messages;
  f: Formatters;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const locale = LANGUAGES.find((l) => l.value === lang)!.locale;

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ lang, setLang, t: MESSAGES[lang], f: createFormatters(locale) }),
    [lang, locale, setLang],
  );

  return (
    <I18nContext.Provider value={value}>
      <LensoI18nProvider locale={locale}>{children}</LensoI18nProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
