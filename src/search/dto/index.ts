import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ example: 'когнитивная терапия' })
  @IsString()
  q!: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  minScore?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @IsOptional()
  limit?: number;
}

export class SuggestQueryDto {
  @ApiProperty({ example: 'когн' })
  @IsString()
  q!: string;
}
