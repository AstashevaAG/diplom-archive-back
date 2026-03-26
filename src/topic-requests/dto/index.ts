import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTopicRequestDto {
  @ApiProperty({ example: 'Влияние медитации на уровень стресса у студентов' })
  @IsString()
  @IsNotEmpty()
  proposedTopic!: string;

  @ApiPropertyOptional({ example: 'Обоснование актуальности темы...' })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiProperty({ description: 'ID выбранного руководителя' })
  @IsString()
  @IsNotEmpty()
  supervisorId!: string;
}
