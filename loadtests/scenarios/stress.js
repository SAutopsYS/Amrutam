import { mixedWorkload } from '../workloads.js';

/**
 * Stress Test — find breaking point beyond peak capacity.
 * Ramps 20 → 200 VUs over 15 minutes.
 */
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '3m', target: 80 },
        { duration: '5m', target: 150 },
        { duration: '4m', target: 200 },
        { duration: '3m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  mixedWorkload();
}
