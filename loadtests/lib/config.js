/**
 * Shared k6 configuration for Amrutam load tests.
 *
 * Scale target: 100,000 consultations/day (~1.2/s avg, ~10/s peak booking writes)
 * SLO: read p95 < 200ms, write p95 < 500ms
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_PREFIX = __ENV.API_PREFIX || '/api/v1';

export const PATIENT_TOKEN = __ENV.PATIENT_TOKEN || '';
export const DOCTOR_TOKEN = __ENV.DOCTOR_TOKEN || '';
export const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

export const DOCTOR_ID = __ENV.DOCTOR_ID || '';
export const SLOT_ID = __ENV.SLOT_ID || '';

export const defaultHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const publicHeaders = () => ({
  headers: { Accept: 'application/json' },
});

/** Read endpoints — p95 < 200ms */
export const readThresholds = {
  http_req_duration: ['p(95)<200'],
  http_req_failed: ['rate<0.01'],
};

/** Write endpoints — p95 < 500ms */
export const writeThresholds = {
  http_req_duration: ['p(95)<500'],
  http_req_failed: ['rate<0.05'],
};

/** Mixed workload */
export const mixedThresholds = {
  http_req_duration: ['p(95)<300', 'p(99)<800'],
  http_req_failed: ['rate<0.02'],
};

export function apiUrl(path) {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

export function checkAuth(tokens) {
  if (!tokens.patient) {
    console.warn('PATIENT_TOKEN not set — run: npm run token:patient');
  }
  if (!tokens.admin) {
    console.warn('ADMIN_TOKEN not set — admin endpoints will fail');
  }
}
