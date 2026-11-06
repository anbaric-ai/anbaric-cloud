/* What a person may do in the tenant this platform serves. The roles are
   assigned in Anbaric Cloud's central login, which owns the tenant definitions
   and the user-to-tenant mapping; the platform only enforces them.

   SUPER_ADMIN is one of the people who run the platform. They can do
   everything an owner can, and are the only ones who can make someone an
   owner; nobody can make anyone a super-admin.

   Mirrored by that control plane's own tenants/TenantRole.ts rather than
   shared with it, so the two repos need not move in lockstep over a five-value
   union. Keep them in step. */
type TenantRole = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "BUILDER" | "USER";

const TENANT_ROLES : Array<TenantRole> = ["SUPER_ADMIN", "OWNER", "ADMIN", "BUILDER", "USER"];

const isTenantRole = (value : unknown) : value is TenantRole =>
    typeof value === "string" && TENANT_ROLES.includes(value as TenantRole);

const isSuperAdmin = (role : TenantRole | undefined) : boolean => role === "SUPER_ADMIN";

/* Inviting and revoking members - administering who else is in the tenant. */
const canInvite = (role : TenantRole | undefined) : boolean =>
    role === "SUPER_ADMIN" || role === "OWNER" || role === "ADMIN";

/* Deploying and tearing down apps, and minting the CLI keypairs that do it.
   A USER can use the tenant's console and its apps, but cannot change them. */
const canBuild = (role : TenantRole | undefined) : boolean =>
    role === "SUPER_ADMIN" || role === "OWNER" || role === "ADMIN" || role === "BUILDER";

/* Whether someone may hand this role out. Nobody makes a super-admin; only a
   super-admin makes an owner. */
const canAssign = (role : TenantRole, by : TenantRole | undefined) : boolean =>
    role !== "SUPER_ADMIN" && (role !== "OWNER" || isSuperAdmin(by));

/* A platform with no membership service in play - a local or unmanaged
   install - resolves no roles at all, and there every caller is allowed, as
   they were before roles existed. Where one is in play the authentication
   middleware has already refused anyone with no membership, so an undefined
   role at a handler means only that roles are not being enforced here. */
const deniesBuild = (role : TenantRole | undefined) : boolean => role !== undefined && ! canBuild(role);

export { TENANT_ROLES, isTenantRole, isSuperAdmin, canInvite, canBuild, canAssign, deniesBuild };
export type { TenantRole };
