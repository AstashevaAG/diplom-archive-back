import { IsNumber, IsOptional, IsString, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    example: { novelty: 8, methodology: 7, practicalValue: 9, formatting: 8, defense: 7 },
    description: 'Баллы по критериям',
  })
  @IsObject()
  criteria!: Record<string, number>;

  @ApiProperty({
    example: { novelty: 0.2, methodology: 0.25, practicalValue: 0.2, formatting: 0.15, defense: 0.2 },
    description: 'Веса критериев',
  })
  @IsObject()
  weights!: Record<string, number>;

  @ApiPropertyOptional({ example: 'Хорошая работа, рекомендую к защите' })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  criteria?: Record<string, number>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  weights?: Record<string, number>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;
}
