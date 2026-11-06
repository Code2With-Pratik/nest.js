import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { ProjectRole } from '../generated/prisma/client.js';
import { ProjectRoles } from '../projects/decorators/project-roles.decorator.js';
import { ProjectRolesGuard } from '../projects/guards/project-roles.guard.js';
import { ActivityService } from './activity.service.js';
import { FindActivitiesDto } from './dto/find-activities.dto.js';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
@ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
@Controller('projects/:projectId/activities')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindActivitiesDto,
  ) {
    return this.activityService.findByProject(
      projectId,
      user.id,
      query.limit,
    );
  }
}
