const DEFAULT_TIME_ZONE = "UTC";
export const SEOUL_TIME_ZONE = "Asia/Seoul";
const SEOUL_TIME_ZONE_OFFSET = "+09:00";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone = DEFAULT_TIME_ZONE) {
  const cacheKey = timeZone || DEFAULT_TIME_ZONE;
  const existing = formatterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: cacheKey,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatDateInTimeZone(value: Date, timeZone = DEFAULT_TIME_ZONE): string {
  try {
    const values: Record<string, string> = {};
    for (const part of getDateFormatter(timeZone).formatToParts(value)) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }

    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch {
    // Fall back to UTC if the upstream API returns an unknown timezone label.
  }

  return value.toISOString().slice(0, 10);
}

export function getCurrentIsoDate(timeZone = DEFAULT_TIME_ZONE): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

export function formatDateTimeInTimeZone(value: Date, timeZone = DEFAULT_TIME_ZONE): string {
  try {
    const values: Record<string, string> = {};
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
      hourCycle: "h23"
    });

    for (const part of formatter.formatToParts(value)) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }

    if (values.year && values.month && values.day && values.hour && values.minute && values.second && values.fractionalSecond) {
      const offset = timeZone === SEOUL_TIME_ZONE ? SEOUL_TIME_ZONE_OFFSET : "Z";
      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}.${values.fractionalSecond}${offset}`;
    }
  } catch {
    // Fall back to UTC output when the timezone is not supported.
  }

  return value.toISOString();
}
