import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'Иванов Иван Иванович' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'ivanov@university.ru' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ example: '221-322' })
  @IsString()
  @IsOptional()
  group?: string;

  @ApiPropertyOptional({ example: 'Клиническая психология' })
  @IsString()
  @IsOptional()
  specialization?: string;
}
