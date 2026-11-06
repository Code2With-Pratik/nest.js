import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ProjectRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { FindTasksDto } from './dto/find-tasks.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';

const taskRelations = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, avatar: true } },
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    await this.projectAccess.requireMembership(dto.projectId, userId);
    await this.assertAssigneeIsMember(dto.projectId, dto.assigneeId);

    return this.prisma.$transaction(async (transaction) => {
      const task = await transaction.task.create({
        data: {
          projectId: dto.projectId,
          createdById: userId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          status: dto.status,
          priority: dto.priority,
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate,
        },
        include: taskRelations,
      });

      await transaction.activity.create({
        data: {
          action: 'task.created',
          description: `Created task "${task.title}"`,
          projectId: task.projectId,
          userId,
        },
      });

      if (task.assigneeId && task.assigneeId !== userId) {
        await transaction.notification.create({
          data: {
            title: 'You were assigned a task',
            message: `You were assigned "${task.title}" in ${task.project.name}.`,
            type: 'TASK_ASSIGNED',
            userId: task.assigneeId,
          },
        });
      }

      return task;
    });
  }

  async findAll(userId: string, filters: FindTasksDto) {
    if (filters.projectId) {
      await this.projectAccess.requireMembership(filters.projectId, userId);
    }

    const where: Prisma.TaskWhereInput = {
      project: { members: { some: { userId } } },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              {
                description: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const data = await this.prisma.task.findMany({
      where,
      include: taskRelations,
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });
    const total = await this.prisma.task.count({ where });

    return { data, total, page: filters.page, limit: filters.limit };
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskRelations,
    });

    if (!task) {
      throw new NotFoundException('Task was not found');
    }

    await this.projectAccess.requireMembership(task.projectId, userId);
    return task;
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        status: true,
        title: true,
        assigneeId: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Task was not found');
    }

    await this.projectAccess.requireMembership(existing.projectId, userId);
    if (dto.assigneeId !== undefined) {
      await this.assertAssigneeIsMember(existing.projectId, dto.assigneeId);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...(dto.title === undefined ? {} : { title: dto.title.trim() }),
      ...(dto.description === undefined
        ? {}
        : { description: dto.description?.trim() ?? null }),
      ...(dto.status === undefined ? {} : { status: dto.status }),
      ...(dto.priority === undefined ? {} : { priority: dto.priority }),
      ...(dto.assigneeId === undefined ? {} : { assigneeId: dto.assigneeId }),
      ...(dto.dueDate === undefined ? {} : { dueDate: dto.dueDate }),
    };

    return this.prisma.$transaction(async (transaction) => {
      const task = await transaction.task.update({
        where: { id },
        data,
        include: taskRelations,
      });

      const action =
        dto.status !== undefined && dto.status !== existing.status
          ? 'task.status_updated'
          : 'task.updated';
      const description =
        action === 'task.status_updated'
          ? `Moved task "${task.title}" to ${task.status}`
          : `Updated task "${task.title}"`;

      await transaction.activity.create({
        data: {
          action,
          description,
          projectId: task.projectId,
          userId,
        },
      });

      const notifications: Array<{
        title: string;
        message: string;
        type: 'TASK_ASSIGNED' | 'TASK_STATUS_UPDATED';
        userId: string;
      }> = [];
      if (
        dto.assigneeId &&
        dto.assigneeId !== existing.assigneeId &&
        dto.assigneeId !== userId
      ) {
        notifications.push({
          title: 'You were assigned a task',
          message: `You were assigned "${task.title}" in ${task.project.name}.`,
          type: 'TASK_ASSIGNED',
          userId: dto.assigneeId,
        });
      }
      if (
        dto.status !== undefined &&
        dto.status !== existing.status &&
        task.assigneeId &&
        task.assigneeId !== userId
      ) {
        notifications.push({
          title: 'Task status updated',
          message: `"${task.title}" is now ${task.status.replace('_', ' ').toLowerCase()}.`,
          type: 'TASK_STATUS_UPDATED',
          userId: task.assigneeId,
        });
      }
      if (notifications.length > 0) {
        await transaction.notification.createMany({ data: notifications });
      }

      return task;
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        projectId: true,
        createdById: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Task was not found');
    }

    const membership = await this.projectAccess.requireMembership(
      task.projectId,
      userId,
    );
    if (
      task.createdById !== userId &&
      membership.role !== ProjectRole.OWNER &&
      membership.role !== ProjectRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot delete this task');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.activity.create({
        data: {
          action: 'task.deleted',
          description: `Deleted task "${task.title}"`,
          projectId: task.projectId,
          userId,
        },
      });
      await transaction.task.delete({ where: { id } });
    });
  }

  private async assertAssigneeIsMember(
    projectId: string,
    assigneeId: string | null | undefined,
  ): Promise<void> {
    if (!assigneeId) {
      return;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('The assignee must be a project member');
    }
  }
}
