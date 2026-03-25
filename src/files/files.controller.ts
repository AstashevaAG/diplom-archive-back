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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards';
import { FilesService } from './files.service';
import { File as PrismaFile } from '@prisma/client';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('works/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Загрузить файл к работе' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('workId') workId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PrismaFile> {
    if (!file) {
      throw new BadRequestException('Файл не предоставлен');
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
