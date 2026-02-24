import { PolicyEngine } from '../../authorization/policy/policy.engine';

describe('PolicyEngine', () => {
  it('should allow user to read own data', () => {
    const engine = new PolicyEngine();

    const condition = {
      '==': [
        { var: 'user.id' },
        { var: 'resource.ownerId' },
      ],
    };

    const context = { user: { id: 'user1' }, resource: { ownerId: 'user1' } };
    const allowed = engine.evaluate(condition, context);

    expect(allowed).toBe(true);
  });

  it('should deny when condition fails', () => {
    const engine = new PolicyEngine();
    const condition = { '==': [{ var: 'user.id' }, { var: 'resource.ownerId' }] };
    const context = { user: { id: 'user1' }, resource: { ownerId: 'user2' } };

    expect(engine.evaluate(condition, context)).toBe(false);
  });
});
