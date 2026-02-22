describe('PermissionGuard', () => {
  it('should throw ForbiddenException if not allowed', async () => {
    const guard = new PermissionGuard(reflector, authz);
    jest.spyOn(authz, 'hasPermission').mockResolvedValue(false);

    await expect(
      guard.canActivate(contextMock)
    ).rejects.toThrow();
  });
});