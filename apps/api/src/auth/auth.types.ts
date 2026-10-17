import type { Role } from '@amprex/shared';

export interface JwtPayload {
  sub: string;
  role: Role;
}

/** The signed-in user, attached to the request by JwtAuthGuard (reloaded from DB each request). */
export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  branchId: string | null;
  /** Set when the user is linked to a Technician row. */
  technicianId: string | null;
}
