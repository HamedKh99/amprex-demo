import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { IS_PUBLIC } from './decorators.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = await this.authenticate(req.headers.authorization);
    if (user) req.user = user;
    if (user || isPublic) return true;
    throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'لطفاً ابتدا وارد شوید.');
  }

  private async authenticate(header: string | undefined): Promise<AuthUser | null> {
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) return null;

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }

    // Reload so deactivation or a role change takes effect before the token expires.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { technician: { select: { id: true } } },
    });
    if (!user?.isActive) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
      technicianId: user.technician?.id ?? null,
    };
  }
}
