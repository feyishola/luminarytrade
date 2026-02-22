@Controller('admin/user-roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequireRole(SystemRole.ADMIN)
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Post()
  assign(@Body() dto: { userId: string; roleId: string }) {
    return this.userRoleService.assignRole(dto.userId, dto.roleId);
  }

  @Delete()
  remove(@Body() dto: { userId: string; roleId: string }) {
    return this.userRoleService.removeRole(dto.userId, dto.roleId);
  }
}