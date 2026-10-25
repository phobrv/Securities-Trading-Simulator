import type { Clock } from "./clock.js";

export class FixedClock implements Clock {
  public constructor(private instant: Date) {}

  public now(): Date {
    return new Date(this.instant.getTime());
  }

  public set(instant: Date): void {
    this.instant = new Date(instant.getTime());
  }
}
