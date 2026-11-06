import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ProjectRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddProjectMemberDto } from './dto/add-project-member.dto.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        ownerId,
        members: {
          create: { userId: ownerId, role: ProjectRole.OWNER },
        },
        activities: {
          create: {
            action: 'project.created',
            description: `Created project "${dto.name.trim()}"`,
            userId: ownerId,
          },
        },
      },
      include: { _count: { select: { tasks: true, members: true } } },
    });
  }

  findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { tasks: true, members: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { tasks: true, members: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.description === undefined
            ? {}
            : { description: dto.description?.trim() ?? null }),
        },
      });

      await transaction.activity.create({
        data: {
          action: 'project.updated',
          description: `Updated project "${project.name}"`,
          projectId: id,
          userId,
        },
      });

      return project;
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  async findMembers(projectId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships;
  }

  async addMember(
    projectId: string,
    actorId: string,
    dto: AddProjectMemberDto,
  ) {
    if (dto.role === ProjectRole.OWNER) {
      throw new BadRequestException('A project owner cannot be assigned as a member');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, avatar: true },
    });
    if (!user) {
      throw new NotFoundException('User was not found');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const membership = await transaction.projectMember.create({
          data: {
            projectId,
            userId: user.id,
            role: dto.role ?? ProjectRole.MEMBER,
          },
          select: { id: true, role: true, joinedAt: true },
        });

        await transaction.activity.create({
          data: {
            action: 'project.member_added',
            description: `Added ${user.email} to the project`,
            projectId,
            userId: actorId,
          },
        });

        return { ...membership, user };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a project member');
      }

      throw error;
    }
  }

  async removeMember(
    projectId: string,
    actorId: string,
    userId: string,
  ): Promise<void> {
    const actorMembership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actorId } },
      select: { role: true },
    });
    const targetMembership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true, user: { select: { email: true } } },
    });

    if (!actorMembership || !targetMembership) {
      throw new NotFoundException('Project member was not found');
    }
    if (
      actorId !== userId &&
      actorMembership.role !== ProjectRole.OWNER &&
      actorMembership.role !== ProjectRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot remove another project member');
    }
    if (
      actorMembership.role === ProjectRole.ADMIN &&
      actorId !== userId &&
      targetMembership.role !== ProjectRole.MEMBER
    ) {
      throw new ForbiddenException('Admins can only remove regular members');
    }
    if (targetMembership.role === ProjectRole.OWNER) {
      throw new BadRequestException('The project owner cannot be removed');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.projectMember.delete({
        where: { projectId_userId: { projectId, userId } },
      });
      await transaction.activity.create({
        data: {
          action: 'project.member_removed',
          description: `Removed ${targetMembership.user.email} from the project`,
          projectId,
          userId: actorId,
        },
      });
    });
  }

  async updateMemberRole(
    projectId: string,
    actorId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<void> {
    if (role === ProjectRole.OWNER) {
      throw new BadRequestException('Project ownership cannot be transferred this way');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!membership) {
      throw new NotFoundException('Project member was not found');
    }
    if (membership.role === ProjectRole.OWNER) {
      throw new BadRequestException('The project owner role cannot be changed');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.projectMember.update({
        where: { projectId_userId: { projectId, userId } },
        data: { role },
      });
      await transaction.activity.create({
        data: {
          action: 'project.member_role_updated',
          description: `Updated ${membership.user.email}'s project role to ${role}`,
          projectId,
          userId: actorId,
        },
      });
    });
  }
}
