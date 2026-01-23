import { Test, TestingModule } from '@nestjs/testing';
import { FoldersService } from './folders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('FoldersService', () => {
  let service: FoldersService;
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a folder with order 0 when no folders exist', async () => {
      const userId = 'user1';
      const createDto = { name: 'New Folder' };

      mockPrismaService.folder.findFirst.mockResolvedValue(null);
      mockPrismaService.folder.create.mockResolvedValue({
        id: 'folder1',
        name: 'New Folder',
        order: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.create(userId, createDto);

      expect(result.order).toBe(0);
      expect(result.name).toBe('New Folder');
    });

    it('should create a folder with incremented order', async () => {
      const userId = 'user1';
      const createDto = { name: 'Second Folder' };

      mockPrismaService.folder.findFirst.mockResolvedValue({
        id: 'folder1',
        order: 5,
      });
      mockPrismaService.folder.create.mockResolvedValue({
        id: 'folder2',
        name: 'Second Folder',
        order: 6,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.create(userId, createDto);

      expect(result.order).toBe(6);
    });
  });

  describe('findAll', () => {
    it('should return all non-deleted folders for a user', async () => {
      const userId = 'user1';
      const folders = [
        {
          id: 'folder1',
          name: 'Folder 1',
          order: 0,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: 'folder2',
          name: 'Folder 2',
          order: 1,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockPrismaService.folder.findMany.mockResolvedValue(folders);

      const result = await service.findAll(userId);

      expect(result).toEqual(folders);
      expect(mockPrismaService.folder.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a folder by id', async () => {
      const userId = 'user1';
      const folderId = 'folder1';
      const folder = {
        id: folderId,
        name: 'Test Folder',
        order: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.folder.findFirst.mockResolvedValue(folder);

      const result = await service.findOne(folderId, userId);

      expect(result).toEqual(folder);
    });

    it('should throw NotFoundException when folder not found', async () => {
      const userId = 'user1';
      const folderId = 'non-existent';

      mockPrismaService.folder.findFirst.mockResolvedValue(null);

      await expect(service.findOne(folderId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a folder', async () => {
      const userId = 'user1';
      const folderId = 'folder1';
      const updateDto = { name: 'Updated Folder' };
      const existingFolder = {
        id: folderId,
        name: 'Old Name',
        order: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const updatedFolder = { ...existingFolder, name: 'Updated Folder' };

      mockPrismaService.folder.findFirst.mockResolvedValue(existingFolder);
      mockPrismaService.folder.update.mockResolvedValue(updatedFolder);

      const result = await service.update(folderId, userId, updateDto);

      expect(result.name).toBe('Updated Folder');
    });
  });

  describe('remove', () => {
    it('should soft delete a folder', async () => {
      const userId = 'user1';
      const folderId = 'folder1';
      const folder = {
        id: folderId,
        name: 'Test Folder',
        order: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.folder.findFirst.mockResolvedValue(folder);
      mockPrismaService.folder.update.mockResolvedValue({
        ...folder,
        deletedAt: new Date(),
      });

      await service.remove(folderId, userId);

      expect(mockPrismaService.folder.update).toHaveBeenCalledWith({
        where: { id: folderId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
