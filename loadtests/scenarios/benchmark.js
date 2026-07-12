import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  apiUrl,
  defaultHeaders,
  publicHeaders,
  PATIENT_TOKEN,
  DOCTOR_TOKEN,
  BASE_URL,
} from '../lib/config.js';

/**
 * Benchmark suite — Auth, Doctor Search, Booking, Consultation
 *
 * Targets (assignment SLOs):
 *   Read  p95 < 200ms
 *   Write p95 < 500ms
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 k6 run loadtests/scenarios/benchmark.js
 *   PATIENT_TOKEN=$(npm run token:patient --silent) DOCTOR_TOKEN=$(npm run token:doctor --silent) \
 *     k6 run --out json=docs/performance/benchmark-raw.json loadtests/scenarios/benchmark.js
 */

const authLatency = new Trend('auth_latency', true);
const searchLatency = new Trend('search_latency', true);
const bookingLatency = new Trend('booking_latency', true);
const consultationLatency = new Trend('consultation_latency', true);
const errorRate = new Rate('benchmark_errors');

let accessToken = PATIENT_TOKEN;
let doctorToken = DOCTOR_TOKEN;

export const options = {
  scenarios: {
    auth: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'benchmarkAuth',
      startTime: '0s',
    },
    search: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 40,
      maxVUs: 80,
      exec: 'benchmarkSearch',
      startTime: '0s',
    },
    booking: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 40,
      exec: 'benchmarkBooking',
      startTime: '10s',
    },
    consultation: {
      executor: 'constant-arrival-rate',
      rate: 15,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 40,
      exec: 'benchmarkConsultation',
      startTime: '5s',
    },
  },
  thresholds: {
    auth_latency: ['p(95)<500'],
    search_latency: ['p(95)<200'],
    booking_latency: ['p(95)<500'],
    consultation_latency: ['p(95)<200'],
    benchmark_errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  if (!accessToken) {
    const login = http.post(
      apiUrl('/auth/login'),
      JSON.stringify({ email: 'patient@amrutam.test', password: 'Password123!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (login.status === 200) {
      const body = login.json('data');
      if (body.mfaRequired) {
        console.warn('Patient has MFA enabled — set PATIENT_TOKEN env for booking benchmarks');
      } else {
        accessToken = body.accessToken;
      }
    }
  }
  return { accessToken, doctorToken, baseUrl: BASE_URL };
}

export function benchmarkAuth() {
  group('auth', () => {
    const start = Date.now();
    const res = http.post(
      apiUrl('/auth/login'),
      JSON.stringify({ email: 'patient@amrutam.test', password: 'Password123!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    authLatency.add(Date.now() - start);
    const ok = check(res, {
      'auth status 200': (r) => r.status === 200,
      'auth has token or mfa': (r) => {
        const d = r.json('data') || {};
        return Boolean(d.accessToken || d.mfaRequired);
      },
    });
    errorRate.add(!ok);
  });
  sleep(0.1);
}

export function benchmarkSearch() {
  group('doctor-search', () => {
    const start = Date.now();
    const res = http.get(apiUrl('/doctors?keyword=ayurveda&limit=10'), publicHeaders());
    searchLatency.add(Date.now() - start);
    const ok = check(res, {
      'search 200': (r) => r.status === 200,
      'search array': (r) => Array.isArray(r.json('data')),
    });
    errorRate.add(!ok);
  });
  sleep(0.05);
}

export function benchmarkBooking() {
  const token = accessToken || PATIENT_TOKEN;
  if (!token) {
    errorRate.add(true);
    return;
  }

  group('booking', () => {
    const doctors = http.get(apiUrl('/doctors?limit=1'), publicHeaders());
    const doctorId = doctors.json('data.0.id');
    if (!doctorId) {
      errorRate.add(true);
      return;
    }
    const slots = http.get(apiUrl(`/doctors/${doctorId}/slots?limit=1`), publicHeaders());
    const slotId = slots.json('data.0.id');
    if (!slotId) {
      // No slots available is not an API failure for latency measurement
      return;
    }

    const start = Date.now();
    const res = http.post(
      apiUrl('/appointments'),
      JSON.stringify({ doctorId, slotId, reason: 'k6 benchmark' }),
      {
        headers: {
          ...defaultHeaders(token).headers,
          'Idempotency-Key': uuidv4(),
        },
      },
    );
    bookingLatency.add(Date.now() - start);
    const ok = check(res, {
      'booking 201/409': (r) => r.status === 201 || r.status === 409,
    });
    errorRate.add(!ok);
  });
  sleep(0.2);
}

export function benchmarkConsultation() {
  const token = accessToken || PATIENT_TOKEN;
  if (!token) {
    errorRate.add(true);
    return;
  }

  group('consultation', () => {
    const start = Date.now();
    const res = http.get(apiUrl('/consultations/me?limit=10'), defaultHeaders(token));
    consultationLatency.add(Date.now() - start);
    const ok = check(res, {
      'consultations 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });
  sleep(0.1);
}
