import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectRolesGuard } from './guards/project-roles.guard.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessService, ProjectRolesGuard],
  exports: [ProjectsService, ProjectAccessService],
})
export class ProjectsModule {}
