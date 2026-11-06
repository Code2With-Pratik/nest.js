import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { ProjectRole } from '../generated/prisma/client.js';
import { AddProjectMemberDto } from './dto/add-project-member.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectRoles } from './decorators/project-roles.decorator.js';
import { ProjectRolesGuard } from './guards/project-roles.guard.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Post(':id/members')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(id, user.id, dto);
  }

  @Get(':id/members')
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  findMembers(@Param('id') id: string) {
    return this.projectsService.findMembers(id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.removeMember(id, user.id, userId);
  }

  @Patch(':id/members/:userId/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER)
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectMemberRoleDto,
  ) {
    return this.projectsService.updateMemberRole(
      id,
      user.id,
      userId,
      dto.role,
    );
  }
}
