type LogLevel = "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown> | undefined;

function truncateText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function serializeValue(value: unknown): string {
  if (value == null) {
    return "null";
  }

  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack?.split("\n").slice(0, 2).join(" | ")
    });
  }

  if (typeof value === "string") {
    return JSON.stringify(truncateText(value));
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value.slice(0, 6));
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

function formatContext(context: LogContext): string {
  if (!context) {
    return "";
  }

  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return "";
  }

  return entries.map(([key, value]) => `${key}=${serializeValue(value)}`).join(" ");
}

function writeLog(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const prefix = `[${new Date().toISOString()}] ${level} ${scope} ${message}`;
  const suffix = formatContext(context);
  const line = suffix ? `${prefix} ${suffix}` : prefix;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createLogger(scope: string) {
  return {
    info(message: string, context?: LogContext) {
      writeLog("INFO", scope, message, context);
    },
    warn(message: string, context?: LogContext) {
      writeLog("WARN", scope, message, context);
    },
    error(message: string, context?: LogContext) {
      writeLog("ERROR", scope, message, context);
    }
  };
}

export function toErrorContext(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split("\n").slice(0, 3).join(" | ")
    };
  }

  return {
    errorMessage: String(error)
  };
}
