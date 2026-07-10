import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  apiUrl,
  defaultHeaders,
  publicHeaders,
  PATIENT_TOKEN,
  ADMIN_TOKEN,
  DOCTOR_ID,
  SLOT_ID,
  BASE_URL,
} from './lib/config.js';

let cachedAccessToken = PATIENT_TOKEN;

export function authFlow() {
  if (cachedAccessToken) {
    const res = http.get(apiUrl('/auth/me'), defaultHeaders(cachedAccessToken));
    check(res, { 'auth: me 200': (r) => r.status === 200 });
    return;
  }
  const login = http.post(
    apiUrl('/auth/login'),
    JSON.stringify({ email: 'patient@amrutam.test', password: 'Password123!' }),
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } },
  );
  check(login, { 'auth: login 200': (r) => r.status === 200 });
  if (login.status === 200) {
    cachedAccessToken = login.json('data.accessToken');
  }
}

export function doctorSearchFlow() {
  const res = http.get(apiUrl('/doctors?keyword=ayurveda&limit=10'), publicHeaders());
  check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: has doctors': (r) => Array.isArray(r.json('data')),
  });
}

export function availabilityFlow() {
  const doctors = http.get(apiUrl('/doctors?limit=1'), publicHeaders());
  const doctorId = doctors.json('data.0.id') || DOCTOR_ID;
  if (!doctorId) return;

  const res = http.get(apiUrl(`/doctors/${doctorId}/slots?limit=10`), publicHeaders());
  check(res, { 'availability: status 200': (r) => r.status === 200 });
}

export function bookingFlow() {
  const token = cachedAccessToken || PATIENT_TOKEN;
  if (!token) return;

  let doctorId = DOCTOR_ID;
  let slotId = SLOT_ID;

  if (!doctorId || !slotId) {
    const doctors = http.get(apiUrl('/doctors?limit=1'), publicHeaders());
    doctorId = doctors.json('data.0.id');
    if (doctorId) {
      const slots = http.get(apiUrl(`/doctors/${doctorId}/slots?limit=1`), publicHeaders());
      slotId = slots.json('data.0.id');
    }
  }

  if (!doctorId || !slotId) return;

  const headers = {
    ...defaultHeaders(token).headers,
    'Idempotency-Key': uuidv4(),
  };
  const res = http.post(
    apiUrl('/appointments'),
    JSON.stringify({ doctorId, slotId, reason: 'k6 load test' }),
    { headers },
  );
  check(res, { 'booking: 201 or 409': (r) => r.status === 201 || r.status === 409 });
}

export function consultationHistoryFlow() {
  const token = cachedAccessToken || PATIENT_TOKEN;
  if (!token) return;
  const res = http.get(apiUrl('/consultations/me?limit=10'), defaultHeaders(token));
  check(res, { 'consultations: status 200': (r) => r.status === 200 });
}

export function analyticsDashboardFlow() {
  const dashboard = http.get(apiUrl('/admin/dashboard'), defaultHeaders(ADMIN_TOKEN));
  check(dashboard, { 'dashboard: 200': (r) => r.status === 200 });
  const analytics = http.get(apiUrl('/admin/analytics?period=daily'), defaultHeaders(ADMIN_TOKEN));
  check(analytics, { 'analytics: 200': (r) => r.status === 200 });
}

export function healthFlow() {
  const res = http.get(apiUrl('/health/ready'), publicHeaders());
  check(res, { 'health: ready': (r) => r.status === 200 });
}

export function mixedWorkload() {
  const roll = Math.random();
  if (roll < 0.30) authFlow();
  else if (roll < 0.45) consultationHistoryFlow();
  else if (roll < 0.55) availabilityFlow();
  else if (roll < 0.65) doctorSearchFlow();
  else if (roll < 0.75) analyticsDashboardFlow();
  else if (roll < 0.85) bookingFlow();
  else healthFlow();
  sleep(Math.random() * 0.5 + 0.1);
}
