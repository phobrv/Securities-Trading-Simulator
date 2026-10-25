import { ApplicationError } from "../../errors/application-error.js";
import type { Clock } from "../../shared/clock/clock.js";

import type {
  ClockMode,
  MarketSession,
  MarketSessionConfig,
  MarketSessionState,
  OrderType,
  SessionWindow,
} from "./market-session.types.js";

type LocalDateTime = {
  date: string;
  weekday: number;
  millisecondsSinceMidnight: number;
};

export class MarketSessionService {
  private readonly configsByMarketCode: ReadonlyMap<
    string,
    MarketSessionConfig
  >;

  public constructor(
    configs: readonly MarketSessionConfig[],
    private readonly clock: Clock,
    private readonly clockMode: ClockMode,
  ) {
    this.configsByMarketCode = createConfigMap(configs);
  }

  public getCurrentSession(marketCode: string): MarketSession {
    return this.getSessionAt(marketCode, this.clock.now());
  }

  public getSessionAt(marketCode: string, instant: Date): MarketSession {
    const config = this.getConfig(marketCode);
    const localDateTime = getLocalDateTime(instant, config.timeZone);
    const isTradingDay =
      config.workingWeekdays.includes(localDateTime.weekday) &&
      !config.holidays.includes(localDateTime.date);

    if (!isTradingDay) {
      return this.createSession(
        config,
        instant,
        localDateTime.date,
        "CLOSED",
        [],
        null,
        false,
      );
    }

    const session = config.sessions.find((window) =>
      containsTime(window, localDateTime.millisecondsSinceMidnight),
    );
    if (session) {
      return this.createSession(
        config,
        instant,
        localDateTime.date,
        session.state,
        session.allowedOrderTypes,
        toZonedInstant(localDateTime.date, session.end, config.timeZone),
        true,
      );
    }

    const firstSession = config.sessions[0];
    if (
      localDateTime.millisecondsSinceMidnight <
      timeToMilliseconds(firstSession.start)
    ) {
      return this.createSession(
        config,
        instant,
        localDateTime.date,
        "PRE_OPEN",
        [],
        toZonedInstant(localDateTime.date, firstSession.start, config.timeZone),
        true,
      );
    }

    return this.createSession(
      config,
      instant,
      localDateTime.date,
      "CLOSED",
      [],
      null,
      true,
    );
  }

  private getConfig(marketCode: string): MarketSessionConfig {
    const config = this.configsByMarketCode.get(marketCode);
    if (!config) {
      throw new MarketSessionNotConfiguredError();
    }

    return config;
  }

  private createSession(
    config: MarketSessionConfig,
    instant: Date,
    tradingDate: string,
    state: MarketSessionState,
    allowedOrderTypes: readonly OrderType[],
    sessionEndsAt: Date | null,
    isTradingDay: boolean,
  ): MarketSession {
    return {
      marketCode: config.marketCode,
      tradingDate,
      timeZone: config.timeZone,
      evaluatedAt: instant.toISOString(),
      state,
      acceptsNewOrders: allowedOrderTypes.length > 0,
      allowedOrderTypes,
      sessionEndsAt: sessionEndsAt?.toISOString() ?? null,
      clockMode: this.clockMode,
      simulation: true,
      isTradingDay,
    };
  }
}

export class MarketSessionNotConfiguredError extends ApplicationError {
  public constructor() {
    super(
      422,
      "MARKET_SESSION_NOT_CONFIGURED",
      "Chưa cấu hình lịch phiên cho thị trường của chứng khoán.",
    );
  }
}

function createConfigMap(
  configs: readonly MarketSessionConfig[],
): ReadonlyMap<string, MarketSessionConfig> {
  const configsByMarketCode = new Map<string, MarketSessionConfig>();

  for (const config of configs) {
    validateMarketSessionConfig(config);
    if (configsByMarketCode.has(config.marketCode)) {
      throw new Error(
        `Trùng cấu hình phiên cho thị trường ${config.marketCode}.`,
      );
    }
    configsByMarketCode.set(config.marketCode, {
      ...config,
      sessions: [...config.sessions].sort(
        (left, right) =>
          timeToMilliseconds(left.start) - timeToMilliseconds(right.start),
      ),
    });
  }

  return configsByMarketCode;
}

function validateMarketSessionConfig(config: MarketSessionConfig): void {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone });
  } catch {
    throw new Error(`Timezone không được hỗ trợ: ${config.timeZone}.`);
  }

  if (config.sessions.length === 0) {
    throw new Error(
      `Thị trường ${config.marketCode} phải có ít nhất một phiên.`,
    );
  }

  const sessions = [...config.sessions].sort(
    (left, right) =>
      timeToMilliseconds(left.start) - timeToMilliseconds(right.start),
  );
  for (const session of sessions) {
    if (timeToMilliseconds(session.start) >= timeToMilliseconds(session.end)) {
      throw new Error(`Khoảng phiên ${session.state} không hợp lệ.`);
    }
  }
  for (let index = 1; index < sessions.length; index += 1) {
    if (
      timeToMilliseconds(sessions[index - 1].end) >
      timeToMilliseconds(sessions[index].start)
    ) {
      throw new Error(
        `Các khoảng phiên của ${config.marketCode} bị chồng lấn.`,
      );
    }
  }
}

function getLocalDateTime(instant: Date, timeZone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const weekdayByName: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayByName[parts.weekday],
    millisecondsSinceMidnight:
      timeToMilliseconds(`${parts.hour}:${parts.minute}:${parts.second}`) +
      instant.getUTCMilliseconds(),
  };
}

function containsTime(session: SessionWindow, time: number): boolean {
  return (
    time >= timeToMilliseconds(session.start) &&
    time < timeToMilliseconds(session.end)
  );
}

function timeToMilliseconds(value: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Thời gian phiên không hợp lệ: ${value}.`);
  }

  const [hours, minutes, seconds] = match.slice(1).map(Number);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new Error(`Thời gian phiên không hợp lệ: ${value}.`);
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1_000;
}

function toZonedInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const approximateInstant = new Date(localAsUtc);
  const localDateTime = getLocalDateTime(approximateInstant, timeZone);
  const [localYear, localMonth, localDay] = localDateTime.date
    .split("-")
    .map(Number);
  const localHours = Math.floor(
    localDateTime.millisecondsSinceMidnight / 3_600_000,
  );
  const localMinutes = Math.floor(
    (localDateTime.millisecondsSinceMidnight % 3_600_000) / 60_000,
  );
  const localSeconds = Math.floor(
    (localDateTime.millisecondsSinceMidnight % 60_000) / 1_000,
  );
  const formattedAsUtc = Date.UTC(
    localYear,
    localMonth - 1,
    localDay,
    localHours,
    localMinutes,
    localSeconds,
  );

  return new Date(localAsUtc - (formattedAsUtc - localAsUtc));
}
