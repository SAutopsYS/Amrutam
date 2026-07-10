import {
  correlationStorage,
  runWithCorrelation,
} from '../../src/common/context/correlation.context';

describe('Correlation context', () => {
  it('propagates context within run scope', () => {
    runWithCorrelation({ correlationId: 'corr-1', requestId: 'req-1' }, () => {
      const store = correlationStorage.getStore();
      expect(store?.correlationId).toBe('corr-1');
      expect(store?.requestId).toBe('req-1');
    });
  });

  it('isolates context between runs', () => {
    runWithCorrelation({ correlationId: 'a', requestId: 'a' }, () => {
      expect(correlationStorage.getStore()?.correlationId).toBe('a');
    });
    runWithCorrelation({ correlationId: 'b', requestId: 'b' }, () => {
      expect(correlationStorage.getStore()?.correlationId).toBe('b');
    });
  });
});
