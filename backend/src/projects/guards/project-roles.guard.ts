import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '../../generated/prisma/client.js';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator.js';
import { ProjectAccessService } from '../project-access.service.js';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const projectParam = request.params.projectId ?? request.params.id;
    const projectId = Array.isArray(projectParam)
      ? projectParam[0]
      : projectParam;
    const userId = request.user?.id;
    if (!projectId || !userId) {
      throw new ForbiddenException('Project membership is required');
    }

    await this.projectAccess.requireRoles(projectId, userId, requiredRoles);
    return true;
  }
}
