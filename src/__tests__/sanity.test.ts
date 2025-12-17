/**
 * Sanity test to verify Jest is working correctly
 */

describe('Test Infrastructure', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should support basic assertions', () => {
    const value = 42;
    expect(value).toBe(42);
    expect(value).toBeGreaterThan(0);
  });

  it('should handle async tests', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });
});
