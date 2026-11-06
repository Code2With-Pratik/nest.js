import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectRole } from '../../generated/prisma/client.js';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({ enum: [ProjectRole.ADMIN, ProjectRole.MEMBER] })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
