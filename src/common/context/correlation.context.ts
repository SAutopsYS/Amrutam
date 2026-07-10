import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationStore {
  correlationId: string;
  requestId: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}

/** Propagates correlation context across HTTP, jobs, and async operations. */
export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelationContext(): CorrelationStore | undefined {
  return correlationStorage.getStore();
}

export function runWithCorrelation<T>(store: CorrelationStore, fn: () => T): T {
  return correlationStorage.run(store, fn);
}

export async function runWithCorrelationAsync<T>(
  store: CorrelationStore,
  fn: () => Promise<T>,
): Promise<T> {
  return correlationStorage.run(store, fn);
}
