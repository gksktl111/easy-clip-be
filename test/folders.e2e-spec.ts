import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FoldersModule } from '../src/folders/folders.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';

describe('FoldersController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const mockPrismaService = {
    folder: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FoldersModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /folders', () => {
    it('should create a new folder', () => {
      const createDto = { name: 'Test Folder' };
      const createdFolder = {
        id: 'folder1',
        name: 'Test Folder',
        order: 0,
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.folder.findFirst.mockResolvedValue(null);
      mockPrismaService.folder.create.mockResolvedValue(createdFolder);

      return request(app.getHttpServer())
        .post('/folders')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Test Folder');
          expect(res.body.order).toBe(0);
        });
    });
  });

  describe('GET /folders', () => {
    it('should return all folders', () => {
      const folders = [
        {
          id: 'folder1',
          name: 'Folder 1',
          order: 0,
          userId: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: 'folder2',
          name: 'Folder 2',
          order: 1,
          userId: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockPrismaService.folder.findMany.mockResolvedValue(folders);

      return request(app.getHttpServer())
        .get('/folders')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('Folder 1');
        });
    });
  });

  describe('GET /folders/:id', () => {
    it('should return a specific folder', () => {
      const folder = {
        id: 'folder1',
        name: 'Test Folder',
        order: 0,
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.folder.findFirst.mockResolvedValue(folder);

      return request(app.getHttpServer())
        .get('/folders/folder1')
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Test Folder');
        });
    });

    it('should return 404 when folder not found', () => {
      mockPrismaService.folder.findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/folders/non-existent')
        .expect(404);
    });
  });

  describe('PATCH /folders/:id', () => {
    it('should update a folder', () => {
      const updateDto = { name: 'Updated Folder' };
      const existingFolder = {
        id: 'folder1',
        name: 'Old Name',
        order: 0,
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const updatedFolder = { ...existingFolder, name: 'Updated Folder' };

      mockPrismaService.folder.findFirst.mockResolvedValue(existingFolder);
      mockPrismaService.folder.update.mockResolvedValue(updatedFolder);

      return request(app.getHttpServer())
        .patch('/folders/folder1')
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Folder');
        });
    });
  });

  describe('DELETE /folders/:id', () => {
    it('should soft delete a folder', () => {
      const folder = {
        id: 'folder1',
        name: 'Test Folder',
        order: 0,
        userId: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.folder.findFirst.mockResolvedValue(folder);
      mockPrismaService.folder.update.mockResolvedValue({
        ...folder,
        deletedAt: new Date(),
      });

      return request(app.getHttpServer())
        .delete('/folders/folder1')
        .expect(204);
    });
  });
});
