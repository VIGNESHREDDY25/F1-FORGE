import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export async function uploadResume(buffer: Buffer, mimetype: string, userId: string): Promise<string> {
  const ext = mimetype === 'application/pdf' ? 'pdf' : 'docx';
  const key = `resumes/${userId}/${uuidv4()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));

  return key;
}

export async function getResumeUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteResume(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.aws.s3Bucket, Key: key }));
}
