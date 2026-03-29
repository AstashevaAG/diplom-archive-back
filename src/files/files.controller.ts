import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { User, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma';
import { File as PrismaFile } from '@prisma/client';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('works/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Загрузить файл к работе (участник или admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('workId') workId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ): Promise<PrismaFile> {
    if (!file) {
      throw new BadRequestException('Файл не предоставлен');
    }
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new BadRequestException('Работа не найдена');
    if (
      work.authorId !== user.id &&
      work.supervisorId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Только участники работы могут загружать файлы');
    }
    return this.filesService.uploadFile(workId, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Скачать/просмотреть файл' })
  async getFile(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const fileData = await this.filesService.getFile(id);
    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileData.originalName)}"`,
    );
    res.sendFile(fileData.path);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить файл' })
  async deleteFile(@Param('id') id: string): Promise<void> {
    return this.filesService.deleteFile(id);
  }
}
