export const ROLE_DEFINITIONS = {
  admin: {
    level: 3,
    displayName: "Admin",
    description: "Full system access",
    canAccess: ["admin", "moderator", "user"] as const,
  },
  moderator: {
    level: 2,
    displayName: "Moderator", 
    description: "Content moderation and user management",
    canAccess: ["moderator", "user"] as const,
  },
  user: {
    level: 1,
    displayName: "User",
    description: "Basic user access",
    canAccess: ["user"] as const,
  },
} as const;

export type UserRole = keyof typeof ROLE_DEFINITIONS;

export const USER_ROLES = Object.keys(ROLE_DEFINITIONS).reduce((acc, role) => {
  acc[role.toUpperCase() as keyof typeof acc] = role as UserRole;
  return acc;
}, {} as Record<string, UserRole>) as Record<string, UserRole>;

export const ROLE_HIERARCHY = Object.entries(ROLE_DEFINITIONS).reduce(
  (acc, [role, config]) => {
    acc[role as UserRole] = config.level;
    return acc;
  },
  {} as Record<UserRole, number>
);

export function hasRoleAccess(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canAccessRole(
  userRole: UserRole,
  targetRole: string
): boolean {
  const userConfig = ROLE_DEFINITIONS[userRole];
  return (userConfig.canAccess as readonly string[]).includes(targetRole);
}

export function canAccessAdmin(userRole: UserRole): boolean {
  return canAccessRole(userRole, "admin");
}

export function canAccessModerator(userRole: UserRole): boolean {
  return canAccessRole(userRole, "moderator");
}

export function canAccessUser(userRole: UserRole): boolean {
  return canAccessRole(userRole, "user");
}

export function getAllRoles(): UserRole[] {
  return Object.keys(ROLE_DEFINITIONS) as UserRole[];
}

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DEFINITIONS[role].displayName;
}

export function getRoleDescription(role: UserRole): string {
  return ROLE_DEFINITIONS[role].description;
}

export function getRolesForSelect(): Array<{
  value: UserRole;
  label: string;
  description: string;
}> {
  return Object.entries(ROLE_DEFINITIONS).map(([role, config]) => ({
    value: role as UserRole,
    label: config.displayName,
    description: config.description,
  }));
}
