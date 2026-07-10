import { CircuitBreaker } from '../../src/common/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after threshold failures', async () => {
    const breaker = new CircuitBreaker(2, 60000);
    const failing = () => Promise.reject(new Error('fail'));

    await expect(breaker.execute(failing)).rejects.toThrow('fail');
    await expect(breaker.execute(failing)).rejects.toThrow('fail');
    await expect(breaker.execute(failing)).rejects.toThrow('Circuit breaker is OPEN');
    expect(breaker.getState()).toBe('OPEN');
  });

  it('resets on success', async () => {
    const breaker = new CircuitBreaker(3, 60000);
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState()).toBe('CLOSED');
  });
});
