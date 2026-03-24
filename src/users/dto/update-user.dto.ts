import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Иванов Иван Иванович' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '221-322' })
  @IsString()
  @IsOptional()
  group?: string;

  @ApiPropertyOptional({ example: 'Клиническая психология' })
  @IsString()
  @IsOptional()
  specialization?: string;

  @ApiPropertyOptional({ example: 'О себе...' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ example: '/uploads/avatars/photo.jpg' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
