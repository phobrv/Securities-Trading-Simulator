import { createClient, type RedisClientType } from "redis";

import { MarketDataUnavailableError } from "./market-data.service.js";
import type { QuoteSnapshot, QuoteStore } from "./market-data.types.js";

const QUOTE_CHANNEL = "md:quotes";

export class RedisQuoteStore implements QuoteStore {
  private readonly commandClient: RedisClientType;
  private readonly subscriberClient: RedisClientType;
  private isSubscriberStarted = false;

  public constructor(redisUrl: string) {
    this.commandClient = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
    });
    this.subscriberClient = this.commandClient.duplicate({
      disableOfflineQueue: true,
    });
    this.commandClient.on("error", (error) =>
      console.error("Redis command client error.", error),
    );
    this.subscriberClient.on("error", (error) =>
      console.error("Redis subscriber client error.", error),
    );
  }

  public async start(onQuote: (quote: QuoteSnapshot) => void): Promise<void> {
    if (this.isSubscriberStarted) {
      return;
    }
    this.isSubscriberStarted = true;

    await this.connectAndSubscribe(onQuote);
  }

  public async getQuote(
    tradingDate: string,
    securityId: string,
  ): Promise<QuoteSnapshot | null> {
    this.assertCommandClientReady();

    try {
      const value = await this.commandClient.get(
        buildQuoteKey(tradingDate, securityId),
      );

      return value ? (JSON.parse(value) as QuoteSnapshot) : null;
    } catch {
      throw new MarketDataUnavailableError();
    }
  }

  public async saveAndPublish(quote: QuoteSnapshot): Promise<void> {
    this.assertCommandClientReady();

    try {
      const serializedQuote = JSON.stringify(quote);
      await this.commandClient.set(
        buildQuoteKey(quote.tradingDate, quote.securityId),
        serializedQuote,
      );
      await this.commandClient.publish(QUOTE_CHANNEL, serializedQuote);
    } catch {
      throw new MarketDataUnavailableError();
    }
  }

  public async close(): Promise<void> {
    await Promise.all([
      closeRedisClient(this.commandClient),
      closeRedisClient(this.subscriberClient),
    ]);
  }

  private async connectAndSubscribe(
    onQuote: (quote: QuoteSnapshot) => void,
  ): Promise<void> {
    await Promise.all([
      this.commandClient.connect(),
      this.subscriberClient.connect(),
    ]);
    await this.subscriberClient.subscribe(QUOTE_CHANNEL, (message) => {
      onQuote(JSON.parse(message) as QuoteSnapshot);
    });
  }

  private assertCommandClientReady(): void {
    if (!this.commandClient.isReady) {
      throw new MarketDataUnavailableError();
    }
  }
}

function buildQuoteKey(tradingDate: string, securityId: string): string {
  return `md:quote:${tradingDate}:${securityId}`;
}

async function closeRedisClient(client: RedisClientType): Promise<void> {
  if (client.isOpen) {
    await client.quit();
  }
}
