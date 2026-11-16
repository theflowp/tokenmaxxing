const parseDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = parseDay(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export const secondsSince = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 1000);

/** Number and date formatters for one locale (e.g. "fr-FR", "en-US", "zh-CN"). */
export function createFormatters(locale: string) {
  const usd = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const usdShort = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const int = new Intl.NumberFormat(locale);
  // "56,7 Md" in French, "56.7B" in English, "567亿" in Chinese.
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const dayShort = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const dayLong = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dayMedium = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  return {
    money: (v: number) => usd.format(v),
    moneyShort: (v: number) => usdShort.format(v),
    percent: (v: number) => pct.format(v),
    integer: (v: number) => int.format(v),
    tokens: (v: number) => compact.format(v),
    dateShort: (d: string) => dayShort.format(parseDay(d)).toUpperCase(),
    dateLong: (d: string) => dayLong.format(parseDay(d)),
    dateMedium: (d: string) => dayMedium.format(parseDay(d)),
    /** Relative time for a past instant at least a minute ago. */
    ago(iso: string): string {
      const s = -secondsSince(iso);
      if (Math.abs(s) < 3600) return relative.format(Math.round(s / 60), "minute");
      if (Math.abs(s) < 86400) return relative.format(Math.round(s / 3600), "hour");
      return relative.format(Math.round(s / 86400), "day");
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
