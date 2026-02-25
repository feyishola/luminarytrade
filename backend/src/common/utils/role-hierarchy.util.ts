export const ROLE_HIERARCHY = {
  SUPER_ADMIN: ['ADMIN', 'ANALYST', 'VIEWER', 'USER'],
  ADMIN: ['ANALYST', 'VIEWER', 'USER'],
  ANALYST: ['VIEWER', 'USER'],
  VIEWER: ['USER'],
  USER: [],
};

export function expandRoles(roleNames: string[]): string[] {
  const expanded = new Set<string>(roleNames);

  roleNames.forEach(role => {
    ROLE_HIERARCHY[role]?.forEach(child => expanded.add(child));
  });

  return Array.from(expanded);
}