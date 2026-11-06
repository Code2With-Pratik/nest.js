import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ProjectRole } from '../../generated/prisma/client.js';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'teammate@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ enum: [ProjectRole.ADMIN, ProjectRole.MEMBER] })
  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;
}
