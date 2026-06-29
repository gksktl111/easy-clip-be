import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { R2ClipImageStorageService } from './r2-clip-image-storage.service';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

const createConfigService = (
  values: Record<string, string | undefined> = {},
): Pick<ConfigService, 'get'> => ({
  get: jest.fn((key: string) => values[key]),
});

describe('R2ClipImageStorageService', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.mocked(S3Client).mockClear();
    jest.mocked(DeleteObjectCommand).mockClear();
  });

  it('public URL에서 object key를 복원해 R2 객체를 삭제한다', async () => {
    const configService = createConfigService({
      R2_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'bucket',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
    });
    const service = new R2ClipImageStorageService(
      configService as ConfigService,
    );

    await service.deleteImage('https://cdn.example.com/clips/user/file.png');

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'clips/user/file.png',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('설정된 public base URL 밖의 이미지는 삭제하지 않는다', async () => {
    const configService = createConfigService({
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
    });
    const service = new R2ClipImageStorageService(
      configService as ConfigService,
    );

    await service.deleteImage('https://other.example.com/clips/user/file.png');

    expect(DeleteObjectCommand).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('R2 삭제 실패 시 INTERNAL 에러를 던진다', async () => {
    const configService = createConfigService({
      R2_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'bucket',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
    });
    mockSend.mockRejectedValue(new Error('r2 failed'));
    const service = new R2ClipImageStorageService(
      configService as ConfigService,
    );

    await expect(
      service.deleteImage('https://cdn.example.com/clips/user/file.png'),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
