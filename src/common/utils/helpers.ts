import { createHash } from 'crypto';

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/^\+/, '');
}

export function createRequestHash(payload: Record<string, unknown>): string {
  return hashValue(JSON.stringify(payload));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
