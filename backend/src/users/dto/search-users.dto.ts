import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchUsersDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q?: string;
}
