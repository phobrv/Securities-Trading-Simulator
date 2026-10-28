import type { Server as HttpServer } from "node:http";

import { WebSocketServer, WebSocket, type RawData } from "ws";

import type { MarketDataService } from "./market-data.service.js";
import type { QuoteSnapshot } from "./market-data.types.js";

type SubscribeMessage = {
  type: "subscribe";
  securityIds: string[];
};

export class MarketDataGateway {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private readonly clients = new Set<MarketDataClient>();

  public constructor(private readonly marketDataService: MarketDataService) {
    this.webSocketServer.on("connection", (webSocket) => {
      const client = new MarketDataClient(webSocket);
      this.clients.add(client);

      webSocket.on("message", (rawMessage) =>
        this.subscribeClient(client, rawMessage),
      );
      webSocket.on("close", () => this.clients.delete(client));
      webSocket.on("error", () => this.clients.delete(client));
    });
  }

  public attach(server: HttpServer): void {
    server.on("upgrade", (request, socket, head) => {
      const requestUrl = new URL(request.url ?? "", "http://localhost");

      if (requestUrl.pathname !== "/ws/market-data") {
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.webSocketServer.emit("connection", webSocket, request);
      });
    });
  }

  public broadcast(quote: QuoteSnapshot): void {
    for (const client of this.clients) {
      if (client.isSubscribedTo(quote.securityId)) {
        client.enqueue(() => client.sendSnapshot(quote));
      }
    }
  }

  public close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.webSocketServer.close();
  }

  private subscribeClient(client: MarketDataClient, rawMessage: RawData): void {
    const message = parseSubscribeMessage(rawMessage);

    if (!message) {
      client.close(1008, "Invalid subscription message.");
      return;
    }

    client.setSubscriptions(message.securityIds);
    client.enqueue(async () => {
      const result = await this.marketDataService.getQuotes(
        message.securityIds,
      );

      for (const quote of result.data) {
        await client.sendSnapshot(quote);
      }
    });
  }
}

class MarketDataClient {
  private readonly securityIds = new Set<string>();
  private delivery: Promise<void> = Promise.resolve();

  public constructor(private readonly webSocket: WebSocket) {}

  public setSubscriptions(securityIds: string[]): void {
    this.securityIds.clear();
    for (const securityId of securityIds) {
      this.securityIds.add(securityId);
    }
  }

  public isSubscribedTo(securityId: string): boolean {
    return this.securityIds.has(securityId);
  }

  public enqueue(action: () => Promise<void>): void {
    const nextDelivery = this.delivery.then(action);
    this.delivery = nextDelivery.catch(() => {
      this.close(1011, "Market Data is unavailable.");
    });
  }

  public async sendSnapshot(quote: QuoteSnapshot): Promise<void> {
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.webSocket.send(
        JSON.stringify({ type: "quote.snapshot", data: quote }),
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  public close(code?: number, reason?: string): void {
    if (this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.close(code, reason);
    }
  }
}

function parseSubscribeMessage(rawMessage: RawData): SubscribeMessage | null {
  try {
    const value: unknown = JSON.parse(rawMessage.toString());

    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as SubscribeMessage).securityIds) ||
      (value as SubscribeMessage).type !== "subscribe"
    ) {
      return null;
    }

    const securityIds = (value as SubscribeMessage).securityIds;
    if (
      securityIds.length === 0 ||
      securityIds.some((securityId) => typeof securityId !== "string") ||
      new Set(securityIds).size !== securityIds.length
    ) {
      return null;
    }

    return { type: "subscribe", securityIds };
  } catch {
    return null;
  }
}
