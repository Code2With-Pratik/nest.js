import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { JsonWebTokenError } from 'jsonwebtoken';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const loginUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  tokenUse: 'refresh';
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTokenTtlSeconds = config.getOrThrow<number>(
      'ACCESS_TOKEN_TTL_SECONDS',
    );
    this.refreshTokenTtlSeconds = config.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_SECONDS',
    );
  }

  async register(dto: RegisterDto): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user
      .create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash: await bcrypt.hash(dto.password, 12),
        },
        select: publicUserSelect,
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('An account with this email already exists');
        }

        throw error;
      });

    return this.createSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: loginUserSelect,
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return this.createSession(publicUser);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const currentTokenHash = this.hashToken(refreshToken);
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        refreshTokenHash: currentTokenHash,
      },
      select: publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    return this.createSession(user, currentTokenHash);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return;
      }

      throw error;
    }

    await this.prisma.user.updateMany({
      where: {
        id: payload.sub,
        refreshTokenHash: this.hashToken(refreshToken),
      },
      data: { refreshTokenHash: null },
    });
  }

  async findUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User account is no longer available');
    }

    return user;
  }

  private async createSession(
    user: PublicUser,
    currentTokenHash?: string,
  ): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: this.accessSecret,
          expiresIn: this.accessTokenTtlSeconds,
        },
      ),
      this.jwt.signAsync(
        { sub: user.id, jti: randomUUID(), tokenUse: 'refresh' },
        {
          secret: this.refreshSecret,
          expiresIn: this.refreshTokenTtlSeconds,
        },
      ),
    ]);

    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        ...(currentTokenHash === undefined
          ? {}
          : { refreshTokenHash: currentTokenHash }),
      },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    if (updated.count !== 1) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    return { accessToken, refreshToken, user };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      throw error;
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      payload.tokenUse !== 'refresh'
    ) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    return payload;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
