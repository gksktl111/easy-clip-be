import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ReorderFolderDto } from './dto/reorder-folder.dto';
import { FolderEntity } from './entities/folder.entity';

@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createFolderDto: CreateFolderDto,
  ): Promise<FolderEntity> {
    const userId = 'test-user-id';
    return this.foldersService.create(userId, createFolderDto);
  }

  @Get()
  async findAll(): Promise<FolderEntity[]> {
    const userId = 'test-user-id';
    return this.foldersService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<FolderEntity> {
    const userId = 'test-user-id';
    return this.foldersService.findOne(id, userId);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(@Body() reorderFolderDto: ReorderFolderDto): Promise<void> {
    const userId = 'test-user-id';
    return this.foldersService.reorder(userId, reorderFolderDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
  ): Promise<FolderEntity> {
    const userId = 'test-user-id';
    return this.foldersService.update(id, userId, updateFolderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    const userId = 'test-user-id';
    return this.foldersService.remove(id, userId);
  }
}
