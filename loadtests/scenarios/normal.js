import { mixedThresholds } from './lib/config.js';
import { mixedWorkload } from './workloads.js';

/**
 * Normal Load — sustained average traffic.
 * ~1.2 bookings/s equivalent with 70% read / 30% write mix.
 * 20 VUs for 5 minutes.
 */
export const options = {
  scenarios: {
    normal: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
    },
  },
  thresholds: mixedThresholds,
};

export default function () {
  mixedWorkload();
}
