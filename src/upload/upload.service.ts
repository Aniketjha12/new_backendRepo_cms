import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly useS3: boolean;

  constructor(private config: ConfigService) {
    this.uploadDir = join(process.cwd(), 'uploads');
    this.useS3 = config.get<boolean>('s3.enabled', false);
    if (!this.useS3 && !existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: { createReadStream: () => NodeJS.ReadableStream; filename: string; mimetype: string }, folder = 'general'): Promise<string> {
    if (this.useS3) {
      return this.uploadToS3(file, folder);
    }
    return this.uploadToLocal(file, folder);
  }

  private async uploadToLocal(file: { createReadStream: () => NodeJS.ReadableStream; filename: string }, folder: string): Promise<string> {
    const ext = extname(file.filename);
    const filename = `${uuidv4()}${ext}`;
    const dir = join(this.uploadDir, folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const path = join(dir, filename);
    const stream = file.createReadStream();

    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(path);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return `/uploads/${folder}/${filename}`;
  }

  private async uploadToS3(file: { createReadStream: () => NodeJS.ReadableStream; filename: string; mimetype: string }, folder: string): Promise<string> {
    // Lazy import to avoid requiring AWS SDK when not configured
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3' as any);
    const client = new S3Client({
      region: this.config.get<string>('s3.region'),
      credentials: {
        accessKeyId: this.config.get<string>('s3.accessKeyId'),
        secretAccessKey: this.config.get<string>('s3.secretAccessKey'),
      },
    });

    const ext = extname(file.filename);
    const key = `${folder}/${uuidv4()}${ext}`;
    const bucket = this.config.get<string>('s3.bucket');

    const chunks: Buffer[] = [];
    for await (const chunk of file.createReadStream()) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: file.mimetype }));
    return `https://${bucket}.s3.${this.config.get('s3.region')}.amazonaws.com/${key}`;
  }

  async deleteFile(url: string): Promise<void> {
    if (this.useS3) {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3' as any);
      const client = new S3Client({
        region: this.config.get<string>('s3.region'),
        credentials: {
          accessKeyId: this.config.get<string>('s3.accessKeyId'),
          secretAccessKey: this.config.get<string>('s3.secretAccessKey'),
        },
      });
      const bucket = this.config.get<string>('s3.bucket');
      const key = url.split('.amazonaws.com/')[1];
      if (key) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    // Local files: just ignore (could add unlink here if needed)
  }
}
