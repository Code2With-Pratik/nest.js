import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'UTC' })
  async createTaskReminders(): Promise<void> {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        assigneeId: { not: null },
        dueDate: { lte: reminderWindow },
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        dueDate: true,
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    for (const task of tasks) {
      if (!task.assigneeId || !task.dueDate) continue;

      const overdue = task.dueDate < now;
      const type = overdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON';
      const title = overdue ? 'Task is overdue' : 'Task due soon';
      const message = overdue
        ? `"${task.title}" in ${task.project.name} is overdue.`
        : `"${task.title}" in ${task.project.name} is due ${task.dueDate.toISOString().slice(0, 10)}.`;
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: task.assigneeId,
          type,
          message,
          createdAt: { gte: startOfDay },
        },
        select: { id: true },
      });
      if (existing) continue;

      await this.prisma.notification.create({
        data: {
          title,
          message,
          type,
          userId: task.assigneeId,
        },
      });
      this.notificationsGateway.emitNewNotification(task.assigneeId);
    }

    this.logger.log(`Processed reminders for ${tasks.length} assigned tasks.`);
  }
}
