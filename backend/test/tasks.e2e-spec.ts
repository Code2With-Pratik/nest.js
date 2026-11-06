import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Tasks, comments, and activity (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const accounts = {
    owner: { name: 'Task Owner', email: `task-owner-${suffix}@example.com` },
    member: {
      name: 'Task Member',
      email: `task-member-${suffix}@example.com`,
    },
    outsider: {
      name: 'Task Outsider',
      email: `task-outsider-${suffix}@example.com`,
    },
  };
  const tokens: Record<keyof typeof accounts, string> = {
    owner: '',
    member: '',
    outsider: '',
  };
  const authorization = (role: keyof typeof tokens) =>
    `Bearer ${tokens[role]}`;
  let projectId = '';
  let taskId = '';
  let commentId = '';

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
          password: 'a-secure-task-test-password',
        })
        .expect(201);
      tokens[role] = response.body.accessToken;
    }

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ name: 'Task test project' })
      .expect(201);
    projectId = project.body.id;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({ email: accounts.member.email })
      .expect(201);
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

  it('creates tasks with project-member assignees and filters accessible tasks', async () => {
    const member = await prisma.user.findUniqueOrThrow({
      where: { email: accounts.member.email },
      select: { id: true },
    });

    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({
        projectId,
        title: 'Prepare launch checklist',
        description: 'Coordinate the first release',
        priority: 'HIGH',
        assigneeId: member.id,
      })
      .expect(201);

    taskId = created.body.id;
    expect(created.body.status).toBe('TODO');
    expect(created.body.priority).toBe('HIGH');
    expect(created.body.assignee.email).toBe(accounts.member.email);

    const listed = await request(app.getHttpServer())
      .get('/tasks')
      .query({ projectId, search: 'launch checklist', page: 1, limit: 5 })
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.data[0].id).toBe(taskId);

    await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${tokens.owner}`)
      .send({
        projectId,
        title: 'Invalid assignee',
        assigneeId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: accounts.outsider.email },
            select: { id: true },
          })
        ).id,
      })
      .expect(400);

    const memberNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('member'))
      .expect(200);
    expect(memberNotifications.body.unreadCount).toBe(2);
    expect(
      memberNotifications.body.data.map(
        (notification: { type: string }) => notification.type,
      ),
    ).toEqual(expect.arrayContaining(['PROJECT_INVITATION', 'TASK_ASSIGNED']));

    const ownerNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('owner'))
      .expect(200);
    expect(ownerNotifications.body.data).toHaveLength(0);
  });

  it('scopes notification reads to the authenticated user', async () => {
    const memberNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('member'))
      .expect(200);
    const assignment = memberNotifications.body.data.find(
      (notification: { type: string }) => notification.type === 'TASK_ASSIGNED',
    ) as { id: string };

    await request(app.getHttpServer())
      .patch(`/notifications/${assignment.id}/read`)
      .set('Authorization', authorization('owner'))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/notifications/${assignment.id}/read`)
      .set('Authorization', authorization('member'))
      .expect(204);

    const updated = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('member'))
      .expect(200);
    expect(updated.body.unreadCount).toBe(1);
    expect(
      updated.body.data.find(
        (notification: { id: string }) => notification.id === assignment.id,
      ).isRead,
    ).toBe(true);

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', authorization('member'))
      .expect(204);
    const allRead = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('member'))
      .expect(200);
    expect(allRead.body.unreadCount).toBe(0);
  });

  it('updates task status and records comments and project activity', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(updated.body.status).toBe('IN_PROGRESS');
    const dashboard = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(200);
    expect(dashboard.body.stats).toMatchObject({
      totalProjects: 1,
      totalTasks: 1,
      inProgressTasks: 1,
      completedTasks: 0,
    });

    const comment = await request(app.getHttpServer())
      .post(`/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .send({ content: 'I am working on this checklist.' })
      .expect(201);
    commentId = comment.body.id;

    const comments = await request(app.getHttpServer())
      .get(`/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(200);
    expect(comments.body).toHaveLength(1);
    expect(comments.body[0].content).toBe('I am working on this checklist.');
    expect(comments.body[0].user).not.toHaveProperty('passwordHash');

    const ownerNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authorization('owner'))
      .expect(200);
    expect(
      ownerNotifications.body.data.map(
        (notification: { type: string }) => notification.type,
      ),
    ).toEqual(
      expect.arrayContaining(['TASK_STATUS_UPDATED', 'COMMENT_ADDED']),
    );

    const activity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activities`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(200);
    expect(activity.body.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining([
        'project.created',
        'project.member_added',
        'task.created',
        'task.status_updated',
        'task.comment_added',
      ]),
    );

    await request(app.getHttpServer())
      .get(`/projects/${projectId}/activities`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .expect(403);
  });

  it('allows authorized comment moderation and protects task deletion', async () => {
    await request(app.getHttpServer())
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokens.outsider}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(404);
  });
});
