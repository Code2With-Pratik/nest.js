import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `taskflow-${randomUUID()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let accessToken: string;
  let initialRefreshCookie: string;
  let rotatedRefreshCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers without returning password hashes or refresh tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'TaskFlow Tester', email, password })
      .expect(201);

    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('refreshToken');
    accessToken = response.body.accessToken;
    initialRefreshCookie = getRefreshCookie(response);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(storedUser.passwordHash).not.toBe(password);
    expect(storedUser.refreshTokenHash).not.toBe(
      initialRefreshCookie.split('=')[1],
    );
    expect(storedUser.refreshTokenHash).toHaveLength(64);
  });

  it('protects the current-user endpoint with the access token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(email);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('refreshTokenHash');
  });

  it('rotates refresh tokens and rejects the previous token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', initialRefreshCookie)
      .expect(200);

    expect(response.body).not.toHaveProperty('refreshToken');
    rotatedRefreshCookie = getRefreshCookie(response);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', initialRefreshCookie)
      .expect(401);
  });

  it('rejects duplicate registrations and invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Duplicate User', email, password })
      .expect(409);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'a-different-long-password' })
      .expect(401);
  });

  it('revokes the rotated token on logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', rotatedRefreshCookie)
      .expect(204)
      .expect('set-cookie', /taskflow_refresh=;/);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', rotatedRefreshCookie)
      .expect(401);
  });

  it('rejects invalid registration data', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'A',
        email: 'not-an-email',
        password: 'short',
        unexpected: true,
      })
      .expect(400);
  });
});

function getRefreshCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const setCookie = response.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookieHeader) {
    throw new Error('Refresh cookie was not set');
  }

  expect(cookieHeader).toMatch(/HttpOnly/i);
  expect(cookieHeader).toMatch(/Path=\/auth/i);
  expect(cookieHeader).toMatch(/SameSite=Lax/i);
  return cookieHeader.split(';', 1)[0];
}
