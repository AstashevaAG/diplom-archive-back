import { Injectable, NotFoundException } from '@nestjs/common';
import { FileType, File as PrismaFile } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma';

interface FileData {
  mimeType: string;
  originalName: string;
  path: string;
}

function determineFileType(mimeType: string): FileType {
  if (mimeType === 'application/pdf') return FileType.PDF;
  if (mimeType.startsWith('video/')) return FileType.VIDEO;
  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('pptx')
  ) {
    return FileType.PRESENTATION;
  }
  return FileType.OTHER;
}

@Injectable()
export class FilesService {
  private readonly uploadDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    workId: string,
    file: Express.Multer.File,
  ): Promise<PrismaFile> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const fileType = determineFileType(file.mimetype);
    const ext = path.extname(file.originalname);
    const filename = `${workId}-${Date.now()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    const savedFile = await this.prisma.file.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type: fileType,
        url: `/uploads/${filename}`,
        workId,
      },
    });

    // If PDF, trigger text extraction asynchronously
    if (fileType === FileType.PDF) {
      void this.extractPdfText(workId, filePath);
    }

    return savedFile;
  }

  async getFile(id: string): Promise<FileData> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('Файл не найден');
    }

    const filePath = path.join(this.uploadDir, file.filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Файл не найден на диске');
    }

    return {
      mimeType: file.mimeType,
      originalName: file.originalName,
      path: path.resolve(filePath),
    };
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('Файл не найден');
    }

    const filePath = path.join(this.uploadDir, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.file.delete({ where: { id } });
  }

  private async extractPdfText(
    workId: string,
    filePath: string,
  ): Promise<void> {
    try {
      const pdfParse = (await import('pdf-parse')).default as (
        buffer: Buffer,
      ) => Promise<{ text: string }>;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);

      await this.prisma.work.update({
        where: { id: workId },
        data: { fullText: data.text },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`PDF parsing failed for work ${workId}: ${message}`);
    }
  }
}
