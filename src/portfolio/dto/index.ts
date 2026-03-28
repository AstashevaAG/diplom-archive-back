import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PortfolioItemType } from '@prisma/client';

export class CreatePortfolioItemDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: PortfolioItemType })
  @IsEnum(PortfolioItemType)
  type!: PortfolioItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;
}

export class UpdatePortfolioItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: PortfolioItemType })
  @IsOptional()
  @IsEnum(PortfolioItemType)
  type?: PortfolioItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;
}
