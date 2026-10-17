import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AppException } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';

// Compared against when the phone is unknown, so response time does not reveal which phones exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { technician: { select: { id: true } }, branch: { select: { id: true, name: true } } },
    });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'شماره موبایل یا رمز عبور نادرست است.',
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        branchId: user.branchId,
        technicianId: user.technician?.id ?? null,
        branch: user.branch,
      },
    };
  }

  async me(user: AuthUser) {
    const branch = user.branchId
      ? await this.prisma.branch.findUnique({
          where: { id: user.branchId },
          select: { id: true, name: true },
        })
      : null;
    return { ...user, branch };
  }
}
