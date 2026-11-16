const usd = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdShort = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

const dec1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("fr-FR");

export const money = (v: number) => usd.format(v);
export const moneyShort = (v: number) => usdShort.format(v);
export const percent = (v: number) => `${dec1.format(v * 100)} %`;
export const integer = (v: number) => int.format(v);

/** 56 700 000 000 -> "56,7 Md" */
export function tokens(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${dec1.format(v / 1e9)} Md`;
  if (abs >= 1e6) return `${dec1.format(v / 1e6)} M`;
  if (abs >= 1e3) return `${dec1.format(v / 1e3)} k`;
  return int.format(v);
}

const dayShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const dayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

const parseDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

export const dateShort = (d: string) => dayShort.format(parseDay(d)).toUpperCase();
export const dateLong = (d: string) => dayLong.format(parseDay(d));

export function ago(iso: string | null): string {
  if (!iso) return "jamais";
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Math.abs(s) < 60) return relative.format(s, "second");
  if (Math.abs(s) < 3600) return relative.format(Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return relative.format(Math.round(s / 3600), "hour");
  return relative.format(Math.round(s / 86400), "day");
}

export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = parseDay(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
