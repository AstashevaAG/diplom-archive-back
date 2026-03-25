import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkStatus } from '@prisma/client';

export class CreateWorkDto {
  @ApiProperty({ example: 'Влияние когнитивно-поведенческой терапии на тревожные расстройства' })
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

export class WorkQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsEnum(WorkStatus)
  @IsOptional()
  status?: WorkStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @IsOptional()
  limit?: number;
}
