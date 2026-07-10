import { mixedThresholds } from '../lib/config.js';
import { mixedWorkload } from '../workloads.js';

/**
 * Peak Load — 5–10x average (morning booking rush).
 * 80 VUs for 10 minutes.
 */
export const options = {
  scenarios: {
    peak: {
      executor: 'constant-vus',
      vus: 80,
      duration: '10m',
    },
  },
  thresholds: {
    ...mixedThresholds,
    http_req_duration: ['p(95)<350', 'p(99)<1000'],
  },
};

export default function () {
  mixedWorkload();
}
