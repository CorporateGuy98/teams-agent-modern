import { config } from "../config";

const lastTicketTime = new Map<string, number>();

export interface RateLimitResult {
  allowed: boolean;
  remainingSeconds: number;
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const last = lastTicketTime.get(userId);

  if (last) {
    const elapsed = (now - last) / 1000;
    if (elapsed < config.rateLimitSeconds) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil(config.rateLimitSeconds - elapsed),
      };
    }
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function recordTicket(userId: string): void {
  lastTicketTime.set(userId, Date.now());
}
