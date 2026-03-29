import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';

export enum SortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  SCORE_DESC = 'scoreDesc',
  SCORE_ASC = 'scoreAsc',
}

export enum StatusFilter {
  PUBLISHED = 'published',
  IN_PROGRESS = 'in_progress',
  ALL = 'all',
}

export class CreateWorkDto {
  @ApiProperty({
    example:
      'Влияние когнитивно-поведенческой терапии на тревожные расстройства',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'Аннотация работы...' })
  @IsString()
  @IsOptional()
  annotation?: string;

  @ApiPropertyOptional({ example: 'Клиническая психология' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: ['КПТ', 'тревожность', 'психотерапия'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 2025 })
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supervisorId?: string;
}

export class UpdateWorkDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  annotation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdateWorkStatusDto {
  @ApiProperty({ enum: WorkStatus })
  @IsEnum(WorkStatus)
  status!: WorkStatus;
}

export class UpdateStageDto {
  @ApiPropertyOptional({ description: 'Отметить этап как выполненный' })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}

export class WorkQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsEnum(WorkStatus)
  @IsOptional()
  status?: WorkStatus;

  @ApiPropertyOptional({ enum: SortBy, default: SortBy.NEWEST })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy;

  @ApiPropertyOptional({ enum: StatusFilter, default: StatusFilter.PUBLISHED })
  @IsEnum(StatusFilter)
  @IsOptional()
  statusFilter?: StatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxScore?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
