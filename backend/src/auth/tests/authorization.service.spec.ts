describe('AuthorizationService', () => {
  let service: AuthorizationService;

  it('should allow permission if role matches', async () => {
    jest.spyOn(service, 'getUserRoleNames')
      .mockResolvedValue(['ADMIN']);

    jest.spyOn(service['roleRepo'], 'find')
      .mockResolvedValue([
        {
          permissions: [
            { resource: 'agents', action: 'READ' }
          ]
        } as any
      ]);

    const result = await service.hasPermission(
      'user1',
      'agents',
      Action.READ,
      {}
    );

    expect(result).toBe(true);
  });

  it('should deny permission if no match', async () => {
    jest.spyOn(service, 'getUserRoleNames')
      .mockResolvedValue(['VIEWER']);

    jest.spyOn(service['roleRepo'], 'find')
      .mockResolvedValue([]);

    const result = await service.hasPermission(
      'user1',
      'agents',
      Action.CREATE,
      {}
    );

    expect(result).toBe(false);
  });
});