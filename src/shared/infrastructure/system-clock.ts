import { Clock } from '../domain/clock.interface';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
  public nowIso(): string {
    return new Date().toISOString();
  }
}
