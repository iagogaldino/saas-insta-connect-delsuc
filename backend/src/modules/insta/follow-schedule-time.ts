import { DateTime } from "luxon";
import { env } from "../../config/env";

export function getDefaultFollowScheduleTimeZone(): string {
  return env.FOLLOW_SCHEDULE_DEFAULT_TIMEZONE;
}

export function normalizeScheduleTimeZoneInput(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    return env.FOLLOW_SCHEDULE_DEFAULT_TIMEZONE;
  }
  const z = raw.trim();
  if (!DateTime.now().setZone(z).isValid) {
    return env.FOLLOW_SCHEDULE_DEFAULT_TIMEZONE;
  }
  return z;
}

export function resolveScheduleTimeZone(stored: string | null | undefined): string {
  const z = typeof stored === "string" ? stored.trim() : "";
  if (z && DateTime.now().setZone(z).isValid) {
    return z;
  }
  return env.FOLLOW_SCHEDULE_DEFAULT_TIMEZONE;
}

/** Domingo JS (0) → domingo Luxon (7); segunda–sábado coincidem (1–6). */
export function jsWeekdayToLuxonWeekday(d: number): number {
  return d === 0 ? 7 : d;
}

export function dateKeyInTimeZone(now: Date, timeZone: string | null | undefined): string {
  const z = resolveScheduleTimeZone(timeZone);
  return DateTime.fromJSDate(now, { zone: z }).toFormat("yyyy-LL-dd");
}

export function getSlotInstantZoned(
  dateKey: string,
  runAtHour: number,
  runAtMinute: number,
  timeZone: string | null | undefined,
): Date | null {
  const z = resolveScheduleTimeZone(timeZone);
  const trimmed = dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const dt = DateTime.fromISO(`${trimmed}T00:00:00`, { zone: z }).set({
    hour: runAtHour,
    minute: runAtMinute,
    second: 0,
    millisecond: 0,
  });
  if (!dt.isValid) {
    return null;
  }
  return dt.toUTC().toJSDate();
}

export function computeNextRunAtZoned(
  schedule: {
    keepActive: boolean;
    weeklyDays: number[];
    runAtHour: number;
    runAtMinute: number;
    oneOffRemainingDates: string[];
    entries: Array<{ date: string; quantity: number; dispatchedAt?: Date | null }>;
  },
  from: Date,
  timeZone: string | null | undefined,
): Date | null {
  const zone = resolveScheduleTimeZone(timeZone);
  const fromZ = DateTime.fromJSDate(from, { zone }).startOf("minute");

  if (schedule.keepActive) {
    if (schedule.weeklyDays.length === 0) {
      return null;
    }
    const weekdaysLuxon = new Set(schedule.weeklyDays.map(jsWeekdayToLuxonWeekday));
    for (let delta = 0; delta <= 14; delta += 1) {
      const cand = fromZ.plus({ days: delta }).set({
        hour: schedule.runAtHour,
        minute: schedule.runAtMinute,
        second: 0,
        millisecond: 0,
      });
      if (cand <= fromZ) {
        continue;
      }
      if (!weekdaysLuxon.has(cand.weekday)) {
        continue;
      }
      return cand.toUTC().toJSDate();
    }
    return null;
  }

  const sorted = [...schedule.oneOffRemainingDates].sort((a, b) => a.localeCompare(b));
  for (const d of sorted) {
    const slot = getSlotInstantZoned(d, schedule.runAtHour, schedule.runAtMinute, zone);
    if (!slot) {
      continue;
    }
    const entry = schedule.entries.find((e) => e.date === d);
    if (entry?.dispatchedAt) {
      continue;
    }
    if (slot.getTime() > from.getTime()) {
      return slot;
    }
  }
  for (const d of sorted) {
    const entry = schedule.entries.find((e) => e.date === d);
    if (entry?.dispatchedAt) {
      continue;
    }
    if (!getSlotInstantZoned(d, schedule.runAtHour, schedule.runAtMinute, zone)) {
      continue;
    }
    return from;
  }
  return null;
}

export function resolveOneOffRunDateToExecuteZoned(
  schedule: {
    keepActive: boolean;
    oneOffRemainingDates: string[];
    runAtHour: number;
    runAtMinute: number;
    entries: Array<{ date: string; quantity: number; dispatchedAt?: Date | null }>;
  },
  now: Date,
  timeZone: string | null | undefined,
): string | null {
  if (schedule.keepActive) {
    return null;
  }
  const z = resolveScheduleTimeZone(timeZone);
  const sorted = [...schedule.oneOffRemainingDates].sort((a, b) => a.localeCompare(b));
  for (const d of sorted) {
    const slot = getSlotInstantZoned(d, schedule.runAtHour, schedule.runAtMinute, z);
    if (!slot || slot.getTime() > now.getTime()) {
      continue;
    }
    const entry = schedule.entries.find((e) => e.date === d);
    if (entry?.dispatchedAt) {
      continue;
    }
    if (!entry || entry.quantity < 1 || entry.quantity > 100) {
      continue;
    }
    return d;
  }
  return null;
}
