import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { SafeUser } from './interfaces';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить текущего пользователя' })
  async getMe(@CurrentUser() user: User): Promise<SafeUser> {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить профиль' })
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('supervisors')
  @ApiOperation({ summary: 'Каталог научных руководителей' })
  async getSupervisors(): Promise<SafeUser[]> {
    return this.usersService.findSupervisors();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Список всех пользователей (Admin)' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  async findAll(@Query('role') role?: Role): Promise<SafeUser[]> {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Профиль пользователя' })
  async findOne(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Изменить роль пользователя (Admin)' })
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @CurrentUser() admin: User,
  ): Promise<SafeUser> {
    return this.usersService.updateRole(id, role, admin);
  }

  @Patch(':id/block')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Заблокировать/разблокировать пользователя (Admin)' })
  async blockUser(
    @Param('id') id: string,
    @Body('block') block: boolean,
    @CurrentUser() admin: User,
  ): Promise<SafeUser> {
    return this.usersService.blockUser(id, block, admin);
  }
}
