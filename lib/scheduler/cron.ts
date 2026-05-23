import { CronExpressionParser } from "cron-parser"

/**
 * Cron expression helpers — timezone-aware.
 *
 * We use 5-field cron (minute, hour, day-of-month, month, day-of-week).
 * Schedules are stored as-is in the DB; timezone is stored separately
 * because cron expressions don't carry tz info.
 */

export interface CronInterpretation {
  valid: boolean
  next?: Date
  human?: string // best-effort human description
  error?: string
}

/**
 * Validate + compute the next fire time for a cron expression in a
 * specific timezone. Returns the next Date *after* `from` (default: now).
 */
export function interpret(
  expression: string,
  timezone: string = "UTC",
  from: Date = new Date(),
): CronInterpretation {
  try {
    const iter = CronExpressionParser.parse(expression, {
      currentDate: from,
      tz: timezone,
    })
    const next = iter.next().toDate()
    return {
      valid: true,
      next,
      human: humanize(expression),
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Best-effort plain-English description of common cron patterns.
 * Falls back to the raw expression for anything non-trivial.
 */
export function humanize(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return expression

  const [min, hour, dom, mon, dow] = parts

  // Daily at HH:MM — */ * * *
  if (dom === "*" && mon === "*" && dow === "*" && isNumeric(min) && isNumeric(hour)) {
    return `Daily at ${formatTime(hour, min)}`
  }

  // Weekdays at HH:MM — */ * * 1-5
  if (dom === "*" && mon === "*" && dow === "1-5" && isNumeric(min) && isNumeric(hour)) {
    return `Weekdays at ${formatTime(hour, min)}`
  }

  // Weekly on specific day — */ * * <0-6>
  if (dom === "*" && mon === "*" && isNumeric(dow) && isNumeric(min) && isNumeric(hour)) {
    return `Weekly on ${dayName(parseInt(dow))} at ${formatTime(hour, min)}`
  }

  // Monthly on specific day — */ <1-31> * *
  if (mon === "*" && dow === "*" && isNumeric(dom) && isNumeric(min) && isNumeric(hour)) {
    return `Monthly on the ${ordinal(parseInt(dom))} at ${formatTime(hour, min)}`
  }

  // Every N hours — 0 */N * * *
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${hour.slice(2)} hours`
  }

  // Every N minutes — */N * * * *
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${min.slice(2)} minutes`
  }

  return expression
}

function isNumeric(s: string): boolean {
  return /^\d+$/.test(s)
}

function formatTime(hour: string, min: string): string {
  const h = parseInt(hour)
  const m = min.padStart(2, "0")
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h < 12 ? "AM" : "PM"
  return `${hour12}:${m} ${ampm}`
}

function dayName(d: number): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return names[d % 7] ?? `day ${d}`
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// ── Preset helpers used by the task-create UI ───────────────

export interface SchedulePreset {
  id: string
  label: string
  buildCron: (hour: number, minute: number) => string
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "daily",
    label: "Every day",
    buildCron: (h, m) => `${m} ${h} * * *`,
  },
  {
    id: "weekdays",
    label: "Weekdays (Mon–Fri)",
    buildCron: (h, m) => `${m} ${h} * * 1-5`,
  },
  {
    id: "weekly-mon",
    label: "Weekly · Monday",
    buildCron: (h, m) => `${m} ${h} * * 1`,
  },
  {
    id: "weekly-sun",
    label: "Weekly · Sunday",
    buildCron: (h, m) => `${m} ${h} * * 0`,
  },
  {
    id: "monthly-1st",
    label: "Monthly · 1st of month",
    buildCron: (h, m) => `${m} ${h} 1 * *`,
  },
]
