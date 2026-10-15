import type { ProviderProfile, TimeOff, Weekday, WorkingHours } from "@/features/operations/types"
import { weekdayLabels, weekdays } from "@/features/operations/types"

const WAT_OFFSET_MS = 3600000
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const dayOrder: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/** A calendar moment in WAT. `minutes` is the minutes since midnight, or null for a date with no time. */
export interface WatMoment {
  date: string
  weekday: Weekday
  minutes: number | null
}

export const isIsoDate = (value: string) => {
  if (typeof value !== "string" || !DATE.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** The date, weekday and time of an instant, read in WAT (UTC+1, no daylight saving). */
export const watMoment = (instant: string | number): WatMoment | null => {
  const ms = typeof instant === "number" ? instant : Date.parse(instant)

  if (Number.isNaN(ms)) return null

  const shifted = new Date(ms + WAT_OFFSET_MS)

  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: dayOrder[shifted.getUTCDay()],
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

/** A request start date is either a plain date ('2026-11-03') or a full date and time. */
export const hasClockTime = (value: string) => /T\d{2}:\d{2}/.test(value)

export const startMoment = (startDate: string): WatMoment | null => {
  const value = startDate.trim()

  if (!value) return null
  if (hasClockTime(value)) return watMoment(value)

  const date = value.slice(0, 10)

  return isIsoDate(date) ? { date, weekday: dayOrder[new Date(`${date}T12:00:00Z`).getUTCDay()], minutes: null } : null
}

export const defaultWorkingHours = (): WorkingHours => ({
  mon: { start: "08:00", end: "17:00" },
  tue: { start: "08:00", end: "17:00" },
  wed: { start: "08:00", end: "17:00" },
  thu: { start: "08:00", end: "17:00" },
  fri: { start: "08:00", end: "17:00" },
  sat: null,
  sun: null,
})

/** Returns a user-facing problem with the hours, or null when they are valid. */
export const workingHoursProblem = (hours: WorkingHours): string | null => {
  if (!hours || typeof hours !== "object") return "Set your weekly working hours."

  let working = 0

  for (const day of weekdays) {
    const entry = hours[day]

    if (entry === null) continue
    if (
      !entry ||
      typeof entry.start !== "string" ||
      typeof entry.end !== "string" ||
      !TIME.test(entry.start) ||
      !TIME.test(entry.end)
    )
      return `Enter ${weekdayLabels[day]} hours as HH:MM.`
    if (toMinutes(entry.end) <= toMinutes(entry.start)) return `${weekdayLabels[day]} must finish after it starts.`
    working++
  }

  return working ? null : "Choose at least one working day."
}

export const timeOffProblem = (entries: Pick<TimeOff, "from" | "to">[]): string | null => {
  for (const entry of entries) {
    if (!isIsoDate(entry.from) || !isIsoDate(entry.to)) return "Enter valid time-off dates."
    if (entry.from > entry.to) return "Time off must end on or after the day it starts."
  }

  return null
}

export const timeOffOn = (timeOff: TimeOff[], date: string) =>
  timeOff.find(entry => entry.from <= date && date <= entry.to)

type Availability = Pick<ProviderProfile, "name" | "workingHours" | "timeOff">

/** Why the provider cannot work at this moment, or null when they can. Without a clock time only the day is checked. */
export const availabilityProblem = (profile: Availability, moment: WatMoment): string | null => {
  const day = profile.workingHours[moment.weekday]

  if (!day) return `${profile.name} doesn’t work on ${weekdayLabels[moment.weekday]}s.`
  if (timeOffOn(profile.timeOff, moment.date)) return `${profile.name} is on time off on ${moment.date}.`
  if (moment.minutes !== null && (moment.minutes < toMinutes(day.start) || moment.minutes >= toMinutes(day.end)))
    return `This time is outside ${profile.name}’s working hours (${weekdayLabels[moment.weekday]} ${day.start}–${day.end}).`

  return null
}
