import { mixedWorkload } from '../workloads.js';

/**
 * Spike Test — sudden traffic burst (marketing campaign / viral event).
 * 20 VUs baseline → 300 VUs spike → back to 20.
 */
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '30s', target: 300 },
        { duration: '2m', target: 300 },
        { duration: '30s', target: 20 },
        { duration: '2m', target: 20 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.15'],
  },
};

export default function () {
  mixedWorkload();
}
