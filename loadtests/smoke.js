import { readThresholds, writeThresholds } from './lib/config.js';
import {
  authFlow,
  doctorSearchFlow,
  availabilityFlow,
  bookingFlow,
  consultationHistoryFlow,
  analyticsDashboardFlow,
} from './workloads.js';

/**
 * Endpoint-focused smoke test — validates each workload in isolation.
 */
export const options = {
  scenarios: {
    auth: { executor: 'per-vu-iterations', vus: 5, iterations: 10, exec: 'auth' },
    search: { executor: 'per-vu-iterations', vus: 5, iterations: 10, exec: 'search', startTime: '5s' },
    availability: { executor: 'per-vu-iterations', vus: 5, iterations: 10, exec: 'availability', startTime: '10s' },
    booking: { executor: 'per-vu-iterations', vus: 3, iterations: 5, exec: 'booking', startTime: '15s' },
    consultations: { executor: 'per-vu-iterations', vus: 5, iterations: 10, exec: 'consultations', startTime: '20s' },
    analytics: { executor: 'per-vu-iterations', vus: 3, iterations: 10, exec: 'analytics', startTime: '25s' },
  },
  thresholds: {
    ...readThresholds,
    ...writeThresholds,
  },
};

export function auth() { authFlow(); }
export function search() { doctorSearchFlow(); }
export function availability() { availabilityFlow(); }
export function booking() { bookingFlow(); }
export function consultations() { consultationHistoryFlow(); }
export function analytics() { analyticsDashboardFlow(); }
