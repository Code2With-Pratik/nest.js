import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async create(taskId: string, userId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        title: true,
        assigneeId: true,
        createdById: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Task was not found');
    }

    await this.projectAccess.requireMembership(task.projectId, userId);
    return this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.comment.create({
        data: { taskId, userId, content: dto.content.trim() },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });

      await transaction.activity.create({
        data: {
          action: 'task.comment_added',
          description: `Commented on task "${task.title}"`,
          projectId: task.projectId,
          userId,
        },
      });

      const recipients = new Set(
        [task.assigneeId, task.createdById].filter(
          (recipientId): recipientId is string =>
            recipientId !== null && recipientId !== userId,
        ),
      );
      if (recipients.size > 0) {
        await transaction.notification.createMany({
          data: Array.from(recipients, (recipientId) => ({
            title: 'New task comment',
            message: `${comment.user.name} commented on "${task.title}".`,
            type: 'COMMENT_ADDED' as const,
            userId: recipientId,
          })),
        });
      }

      return comment;
    });
  }

  async findAll(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) {
      throw new NotFoundException('Task was not found');
    }

    await this.projectAccess.requireMembership(task.projectId, userId);
    return this.prisma.comment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        content: true,
        task: { select: { projectId: true } },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment was not found');
    }

    const membership = await this.projectAccess.requireMembership(
      comment.task.projectId,
      userId,
    );
    if (
      comment.userId !== userId &&
      membership.role !== ProjectRole.OWNER &&
      membership.role !== ProjectRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.comment.delete({ where: { id } });
      await transaction.activity.create({
        data: {
          action: 'task.comment_removed',
          description: 'Removed a task comment',
          projectId: comment.task.projectId,
          userId,
        },
      });
    });
  }
}
