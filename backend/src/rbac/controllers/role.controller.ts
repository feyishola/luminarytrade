import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemRole } from '../../common/constants/roles.enum';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequireRole(SystemRole.ADMIN)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  findAll() {
    return this.roleService.findAll();
  }

  @Post()
  create(@Body() dto: any) {
    return this.roleService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
}