import { DataSource } from 'typeorm';
import { Role } from '../../rbac/entities/role.entity';
import { SystemRole } from '../../common/constants/roles.enum';

export async function seedRoles(dataSource: DataSource) {
  const repo = dataSource.getRepository(Role);

  for (const role of Object.values(SystemRole)) {
    await repo.save({
      name: role,
      description: `${role} system role`,
      isSystem: true,
    });
  }
}