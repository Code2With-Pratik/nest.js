import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Projects and users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const accounts = {
    owner: { name: 'Project Owner', email: `owner-${suffix}@example.com` },
    admin: { name: 'Project Admin', email: `admin-${suffix}@example.com` },
    member: { name: 'Project Member', email: `member-${suffix}@example.com` },
    outsider: {
      name: 'Project Outsider',
      email: `outsider-${suffix}@example.com`,
    },
  };
  const tokens: Record<keyof typeof accounts, string> = {
    owner: '',
    admin: '',
    member: '',
    outsider: '',
  };
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);

    for (const [role, account] of Object.entries(accounts) as [
      keyof typeof accounts,
      (typeof accounts)[keyof typeof accounts],
    ][]) {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...account,
          password: 'a-secure-project-test-password',
        })
        .expect(201);
      tokens[role] = response.body.accessToken;
    }
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(accounts).map(({ email }) => email) } },
    });
    await app.close();
  });

  it('creates projects with an owner membership and restricts outsiders', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ name: 'Launch plan', description: 'Project access test' })
      .expect(201);

    projectId = created.body.id;
    expect(created.body.ownerId).toBeDefined();
    expect(created.body._count.members).toBe(1);

    const listed = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(200);
    expect(listed.body.map((project: { id: string }) => project.id)).toContain(
      projectId,
    );

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .expect(403);

    const ownerMembership = await prisma.projectMember.findUniqueOrThrow({
      where: {
        projectId_userId: {
          projectId,
          userId: created.body.ownerId,
        },
      },
    });
    expect(ownerMembership.role).toBe('OWNER');
  });

  it('enforces owner and admin project permissions', async () => {
    const adminMembership = await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ email: accounts.admin.email, role: 'ADMIN' })
      .expect(201);
    expect(adminMembership.body.role).toBe('ADMIN');

    const memberMembership = await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ email: accounts.member.email })
      .expect(201);
    expect(memberMembership.body.role).toBe('MEMBER');

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ email: accounts.member.email })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ email: accounts.outsider.email, role: 'OWNER' })
      .expect(400);

    const updated = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ name: 'Updated launch plan' })
      .expect(200);
    expect(updated.body.name).toBe('Updated launch plan');

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({ name: 'Unauthorized update' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/members/${accounts.member.email}/role`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ role: 'ADMIN' })
      .expect(403);
  });

  it('supports profile updates and keeps member routes scoped', async () => {
    const profile = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({ name: 'Updated Member' })
      .expect(200);
    expect(profile.body.name).toBe('Updated Member');
    expect(profile.body).not.toHaveProperty('passwordHash');

    const users = await request(app.getHttpServer())
      .get('/users')
      .query({ q: accounts.member.email })
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(200);
    expect(users.body).toHaveLength(1);
    expect(users.body[0]).not.toHaveProperty('passwordHash');
    expect(users.body[0]).not.toHaveProperty('refreshTokenHash');

    const members = await request(app.getHttpServer())
      .get(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(200);
    expect(members.body).toHaveLength(3);

    const member = await prisma.user.findUniqueOrThrow({
      where: { email: accounts.member.email },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/members/${member.id}`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(403);
  });

  it('allows the owner to change roles and delete the project', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: accounts.admin.email },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/members/${admin.id}/role`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ role: 'MEMBER' })
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/members/${admin.id}`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(204);

    projectId = '';
  });
});
