/** Formatação de data/hora no padrão brasileiro (pt-BR). */
export const LOCALE_BR = "pt-BR" as const

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

/** Data e hora a partir de ISO string, timestamp ou `Date` (ex.: 27/04/2026, 14:30). */
export function formatDateTimeBr(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(LOCALE_BR, dateTimeOptions)
}

/**
 * `YYYY-MM-DD` de calendário → `dd/mm/aaaa` (sem deslocar por fuso: usa partes no local).
 * Se não bater o padrão, devolve o texto original.
 */
export function formatIsoDateBr(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ymd
  return dt.toLocaleDateString(LOCALE_BR, { day: "2-digit", month: "2-digit", year: "numeric" })
}
