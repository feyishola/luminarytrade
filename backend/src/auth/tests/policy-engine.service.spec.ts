describe('PolicyEngine', () => {
  it('should allow user to read own data', () => {
    const engine = new PolicyEngine();

    const condition = {
      "==": [
        { "var": "user.id" },
        { "var": "resource.ownerId" }
      ]
    };

    const result = engine.evaluate(condition, {
      user: { id: '123' },
      resource: { ownerId: '123' }
    });

    expect(result).toBe(true);
  });
});