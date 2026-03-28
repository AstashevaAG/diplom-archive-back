import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User, StudentPortfolioItem } from '@prisma/client';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { ConfigService } from '@nestjs/config';

@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Добавить элемент в портфолио' })
  async create(
    @Body() dto: CreatePortfolioItemDto,
    @CurrentUser() user: User,
  ): Promise<StudentPortfolioItem> {
    return this.portfolioService.create(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Моё портфолио' })
  async getMy(@CurrentUser() user: User): Promise<StudentPortfolioItem[]> {
    return this.portfolioService.findByStudent(user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить элемент портфолио' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioItemDto,
    @CurrentUser() user: User,
  ): Promise<StudentPortfolioItem> {
    return this.portfolioService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить элемент портфолио' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.portfolioService.delete(id, user.id);
  }

  @Post(':id/file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Загрузить файл к элементу портфолио' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir =
            process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `portfolio-${req.params.id}-${Date.now()}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ): Promise<StudentPortfolioItem> {
    if (!file) throw new BadRequestException('Файл не предоставлен');
    const fileUrl = `/uploads/${file.filename}`;
    return this.portfolioService.setFileUrl(id, user.id, fileUrl);
  }
}
