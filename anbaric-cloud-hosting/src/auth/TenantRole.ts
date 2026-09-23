/* What a person may do in the tenant this platform serves. The roles are
   assigned in Anbaric Cloud's central login, which owns the tenant definitions
   and the user-to-tenant mapping; the platform only enforces them.

   Mirrored by that control plane's own tenants/TenantRole.ts rather than
   shared with it, so the two repos need not move in lockstep over a four-value
   union. Keep them in step. */
type TenantRole = "OWNER" | "ADMIN" | "BUILDER" | "USER";

const TENANT_ROLES : Array<TenantRole> = ["OWNER", "ADMIN", "BUILDER", "USER"];

const isTenantRole = (value : unknown) : value is TenantRole =>
    typeof value === "string" && TENANT_ROLES.includes(value as TenantRole);

/* Inviting and revoking members - administering who else is in the tenant. */
const canInvite = (role : TenantRole | undefined) : boolean =>
    role === "OWNER" || role === "ADMIN";

/* Deploying and tearing down apps, and minting the CLI keypairs that do it.
   A USER can use the tenant's console and its apps, but cannot change them. */
const canBuild = (role : TenantRole | undefined) : boolean =>
    role === "OWNER" || role === "ADMIN" || role === "BUILDER";

/* A platform with no membership service in play - a local or unmanaged
   install - resolves no roles at all, and there every caller is allowed, as
   they were before roles existed. Where one is in play the authentication
   middleware has already refused anyone with no membership, so an undefined
   role at a handler means only that roles are not being enforced here. */
const deniesBuild = (role : TenantRole | undefined) : boolean => role !== undefined && ! canBuild(role);

export { TENANT_ROLES, isTenantRole, canInvite, canBuild, deniesBuild };
export type { TenantRole };
