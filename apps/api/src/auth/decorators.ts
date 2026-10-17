import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@amprex/shared';
import type { AuthUser } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** No login required. A valid token is still read, so @CurrentUser() may be set. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);
