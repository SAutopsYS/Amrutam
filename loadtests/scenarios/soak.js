import { mixedThresholds } from '../lib/config.js';
import { mixedWorkload } from '../workloads.js';

/**
 * Soak Test — sustained moderate load to detect memory leaks and connection exhaustion.
 * 40 VUs for 30 minutes.
 */
export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 40,
      duration: '30m',
    },
  },
  thresholds: mixedThresholds,
};

export default function () {
  mixedWorkload();
}
