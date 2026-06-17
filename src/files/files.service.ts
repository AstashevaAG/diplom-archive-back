import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileType, File as PrismaFile, Role, User } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeFileNameEncoding } from './file-name.utils';

interface FileData {
  mimeType: string;
  originalName: string;
  path: string;
}

interface UploadFileOptions {
  indexForSearch?: boolean;
}

export interface FileMetadataChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

export interface TextDiffItem {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface FileVersionCompareResult {
  from: PrismaFile;
  to: PrismaFile;
  metadataChanges: FileMetadataChange[];
  textDiff: {
    available: boolean;
    message?: string;
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
    items: TextDiffItem[];
  };
}

const execFileAsync = promisify(execFile);

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    this.uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    workId: string,
    file: Express.Multer.File,
    uploader: User,
    comment?: string,
    options: UploadFileOptions = {},
  ): Promise<PrismaFile> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        authorId: true,
        supervisorId: true,
      },
    });
    if (!work) {
      throw new NotFoundException('Работа не найдена');
    }

    const latest = await this.prisma.file.findFirst({
      where: { workId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const fileType = determineFileType(file.mimetype);
    const version = (latest?.version ?? 0) + 1;
    const originalName = normalizeFileNameEncoding(file.originalname);
    const ext = path.extname(originalName);
    const filename = `${workId}-v${version}-${Date.now()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);
    const cleanComment = comment?.trim() || null;

    fs.writeFileSync(filePath, file.buffer);

    const savedFile = await this.prisma.file.create({
      data: {
        filename,
        originalName,
        mimeType: file.mimetype,
        size: file.size,
        type: fileType,
        url: `/uploads/${filename}`,
        version,
        comment: cleanComment,
        workId,
      },
    });

    if (options.indexForSearch) {
      void this.extractTextForFile(
        savedFile.id,
        workId,
        filePath,
        file.mimetype,
        originalName,
      );
    }

    await this.notifyVersionUploaded(work, savedFile, uploader);

    return savedFile;
  }

  async findVersions(workId: string, user: User): Promise<PrismaFile[]> {
    await this.assertWorkAccess(workId, user);

    const files = await this.prisma.file.findMany({
      where: { workId },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });

    return files.map((file) => this.normalizeFileRecordName(file));
  }

  async compareVersions(
    workId: string,
    fromFileId: string,
    toFileId: string,
    user: User,
  ): Promise<FileVersionCompareResult> {
    const work = await this.assertWorkAccess(workId, user);
    if (work.supervisorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Сравнение версий доступно преподавателю');
    }
    if (fromFileId === toFileId) {
      throw new BadRequestException('Выберите две разные версии');
    }

    const files = await this.prisma.file.findMany({
      where: { id: { in: [fromFileId, toFileId] }, workId },
    });
    const fromRecord = files.find((f) => f.id === fromFileId);
    const toRecord = files.find((f) => f.id === toFileId);
    const from = fromRecord && this.normalizeFileRecordName(fromRecord);
    const to = toRecord && this.normalizeFileRecordName(toRecord);
    if (!from || !to) {
      throw new NotFoundException('Одна из версий не найдена');
    }
    if (from.type !== FileType.PDF || to.type !== FileType.PDF) {
      throw new BadRequestException('Сравнение доступно только для PDF-файлов');
    }

    const fromText = await this.getTextForComparison(from);
    const toText = await this.getTextForComparison(to);

    return {
      from,
      to,
      metadataChanges: this.buildMetadataChanges(from, to),
      textDiff: this.buildTextDiff(fromText, toText),
    };
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
      originalName: normalizeFileNameEncoding(file.originalName),
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
    await this.refreshWorkFullText(file.workId);
  }

  private async assertWorkAccess(
    workId: string,
    user: User,
  ): Promise<{
    id: string;
    title: string;
    authorId: string;
    supervisorId: string | null;
  }> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        authorId: true,
        supervisorId: true,
      },
    });
    if (!work) throw new NotFoundException('Работа не найдена');
    if (
      work.authorId !== user.id &&
      work.supervisorId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Нет доступа к файлам работы');
    }
    return work;
  }

  private async notifyVersionUploaded(
    work: {
      id: string;
      title: string;
      authorId: string;
      supervisorId: string | null;
    },
    file: PrismaFile,
    uploader: User,
  ): Promise<void> {
    const recipients = new Set<string>();
    if (work.authorId !== uploader.id) recipients.add(work.authorId);
    if (work.supervisorId && work.supervisorId !== uploader.id) {
      recipients.add(work.supervisorId);
    }
    if (recipients.size === 0) return;

    await Promise.all(
      [...recipients].map((userId) =>
        this.notifications.create({
          userId,
          type: 'WORK_FILE_VERSION_UPLOADED',
          title: `Загружена версия ${file.version}`,
          message: `${uploader.fullName} загрузил(а) новую версию файла для работы «${work.title}»: ${file.originalName}.`,
          data: {
            workId: work.id,
            fileId: file.id,
            version: String(file.version),
            uploaderId: uploader.id,
            uploaderName: uploader.fullName,
          },
        }),
      ),
    );
  }

  private async extractTextForFile(
    fileId: string,
    workId: string,
    filePath: string,
    mimeType: string,
    originalName: string,
  ): Promise<void> {
    try {
      const text = await this.extractPlainText(
        filePath,
        mimeType,
        originalName,
      );
      if (!text) return;

      await this.prisma.file.update({
        where: { id: fileId },
        data: { textContent: text },
      });

      await this.refreshWorkFullText(workId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Text extraction failed for file ${fileId}: ${message}`);
    }
  }

  private async refreshWorkFullText(workId: string): Promise<void> {
    const files = await this.prisma.file.findMany({
      where: {
        workId,
        textContent: { not: null },
      },
      select: {
        textContent: true,
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });

    const fullText = files
      .map((file) => file.textContent?.trim())
      .filter((text): text is string => Boolean(text))
      .join('\n\n');

    await this.prisma.work.update({
      where: { id: workId },
      data: { fullText: fullText || null },
    });
  }

  private async getTextForComparison(file: PrismaFile): Promise<string | null> {
    if (file.textContent?.trim()) {
      return file.textContent;
    }

    const filePath = path.join(this.uploadDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      return await this.extractPlainText(
        filePath,
        file.mimeType,
        file.originalName,
      );
    } catch {
      return null;
    }
  }

  private async extractPlainText(
    filePath: string,
    mimeType: string,
    originalName: string,
  ): Promise<string | null> {
    const ext = path.extname(originalName).toLowerCase();
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default as (
        buffer: Buffer,
      ) => Promise<{ text: string }>;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return this.normalizeText(data.text);
    }

    if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      const { stdout } = await execFileAsync(
        'unzip',
        ['-p', filePath, 'word/document.xml'],
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      );
      const text = String(stdout)
        .replace(/<w:tab\s*\/>/g, '\t')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      return this.normalizeText(text);
    }

    if (mimeType.startsWith('text/') || ['.txt', '.md'].includes(ext)) {
      return this.normalizeText(fs.readFileSync(filePath, 'utf8'));
    }

    return null;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private normalizeFileRecordName(file: PrismaFile): PrismaFile {
    return {
      ...file,
      originalName: normalizeFileNameEncoding(file.originalName),
    };
  }

  private buildMetadataChanges(
    from: PrismaFile,
    to: PrismaFile,
  ): FileMetadataChange[] {
    const rows: Array<[string, string, string | null, string | null]> = [
      ['version', 'Номер версии', String(from.version), String(to.version)],
      ['originalName', 'Имя файла', from.originalName, to.originalName],
      ['type', 'Тип', from.type, to.type],
      ['size', 'Размер, байт', String(from.size), String(to.size)],
      [
        'createdAt',
        'Дата загрузки',
        from.createdAt.toISOString(),
        to.createdAt.toISOString(),
      ],
      ['comment', 'Комментарий к версии', from.comment, to.comment],
    ];

    return rows.map(([field, label, before, after]) => ({
      field,
      label,
      before,
      after,
      changed: before !== after,
    }));
  }

  private buildTextDiff(
    fromText: string | null,
    toText: string | null,
  ): FileVersionCompareResult['textDiff'] {
    if (!fromText || !toText) {
      return {
        available: false,
        message:
          'Текстовый diff недоступен: для одной из версий не удалось извлечь plain text. Показано сравнение метаданных.',
        addedCount: 0,
        removedCount: 0,
        unchangedCount: 0,
        items: [],
      };
    }

    const before = this.splitDiffLines(fromText).slice(0, 180);
    const after = this.splitDiffLines(toText).slice(0, 180);
    const dp = Array.from({ length: before.length + 1 }, () =>
      Array<number>(after.length + 1).fill(0),
    );

    for (let i = 1; i <= before.length; i += 1) {
      for (let j = 1; j <= after.length; j += 1) {
        dp[i][j] =
          before[i - 1] === after[j - 1]
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const items: TextDiffItem[] = [];
    let i = before.length;
    let j = after.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
        items.push({ type: 'unchanged', text: before[i - 1] });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        items.push({ type: 'added', text: after[j - 1] });
        j -= 1;
      } else if (i > 0) {
        items.push({ type: 'removed', text: before[i - 1] });
        i -= 1;
      }
    }

    const ordered = items.reverse();
    return {
      available: true,
      addedCount: ordered.filter((item) => item.type === 'added').length,
      removedCount: ordered.filter((item) => item.type === 'removed').length,
      unchangedCount: ordered.filter((item) => item.type === 'unchanged')
        .length,
      items: ordered.slice(0, 180),
    };
  }

  private splitDiffLines(text: string): string[] {
    return text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }
}
