import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Permission } from '../rbac/entities/permission.entity';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Policy } from '../rbac/entities/policy.entity';
import { AuthorizationAudit } from '../rbac/entities/authorization-audit.entity';
import { expandRoles } from '../common/utils/role-hierarchy.util';
import { Action } from '../common/constant/actions.enum';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PolicyEngine } from './policy/policy.engine';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(Policy) private policyRepo: Repository<Policy>,
    @InjectRepository(AuthorizationAudit) private auditRepo: Repository<AuthorizationAudit>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private policyEngine = new PolicyEngine();

  async hasRole(userId: string, role: string): Promise<boolean> {
    const roles = await this.getUserRoleNames(userId);
    return expandRoles(roles).includes(role);
  }

  async hasPermission(userId: string, resource: string, action: Action, context?: any) {
    const cacheKey = `perm:${userId}:${resource}:${action}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== undefined) return cached;

    const roles = await this.getUserRoleNames(userId);
    const expanded = expandRoles(roles);

    const roleEntities = await this.roleRepo.find({
      where: { name: In(expanded) },
      relations: ['permissions'],
    });

    const permissionMatch = roleEntities.some(role =>
      role.permissions.some(p => p.resource === resource && p.action === action),
    );

    const policy = await this.policyRepo.findOne({
      where: { resource, action, isActive: true },
    });

    let policyResult = true;

    if (policy) {
      policyResult = this.policyEngine.evaluate(policy.conditionJson, context);
    }

    const allowed = permissionMatch && policyResult;

    await this.cache.set(cacheKey, allowed, 60);

    await this.auditRepo.save({
      userId,
      resource,
      action,
      allowed,
    });

    return allowed;
  }

  private async getUserRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({ where: { userId } });
    const roles = await this.roleRepo.findBy({
      id: In(userRoles.map(r => r.roleId)),
    });

    return roles.map(r => r.name);
  }
}
