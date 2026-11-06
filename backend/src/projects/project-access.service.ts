import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProjectRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(projectId: string, userId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return membership;
  }

  async requireRoles(
    projectId: string,
    userId: string,
    roles: ProjectRole[],
  ): Promise<void> {
    const membership = await this.requireMembership(projectId, userId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission for this project');
    }
  }
}
