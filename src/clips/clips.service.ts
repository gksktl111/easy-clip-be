import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClipType, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DetectedClip, detectClipType } from './clip-type-detector';
import { CreateClipDto } from './dtos/create-clip.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';

@Injectable()
export class ClipsService {
  constructor(private prisma: PrismaService) {}

  // 파일이 있으면 IMAGE, 없으면 text를 색상/텍스트로 판별해 클립을 생성한다.
  async createClip(
    userId: string,
    dto: CreateClipDto,
    file?: Express.Multer.File,
  ) {
    const folder = await this.getPersonalFolder(userId, dto.folderId);
    const clipData = this.resolveClipData(dto.text, file);

    return this.prisma.clip.create({
      data: {
        type: clipData.type,
        title: clipData.title,
        folderId: folder.id,
        workspaceId: folder.workspaceId,
        textContent: clipData.textContent,
        colorHex: clipData.colorHex,
        imageUrl: clipData.imageUrl,
      },
    });
  }

  // 개인 워크스페이스 소유의 활성(삭제되지 않은) 클립을 단건 조회한다.
  async getClipById(userId: string, clipId: string) {
    const clip = await this.prisma.clip.findFirst({
      where: {
        id: clipId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('클립을 찾을 수 없습니다.');
    }

    return clip;
  }

  // 파일 또는 text가 주어지면 타입을 재판별하고, 없으면 폴더 이동만 처리한다.
  async updateClip(
    userId: string,
    clipId: string,
    dto: UpdateClipDto,
    file?: Express.Multer.File,
  ) {
    const clip = await this.getClipForUser(userId, clipId);
    const nextFolder = dto.folderId
      ? await this.getPersonalFolder(userId, dto.folderId)
      : { id: clip.folderId, workspaceId: clip.workspaceId };
    const clipData =
      file || dto.text
        ? this.resolveClipData(dto.text, file)
        : {
            type: clip.type,
            title: clip.title,
            textContent: clip.textContent,
            colorHex: clip.colorHex,
            imageUrl: clip.imageUrl,
          };

    return this.prisma.clip.update({
      where: { id: clip.id },
      data: {
        type: clipData.type,
        title: clipData.title,
        folderId: nextFolder.id,
        workspaceId: nextFolder.workspaceId,
        textContent: clipData.textContent,
        colorHex: clipData.colorHex,
        imageUrl: clipData.imageUrl,
      },
    });
  }

  // 클립을 즉시 삭제하지 않고 deletedAt만 기록하는 소프트 삭제로 처리한다.
  async deleteClip(userId: string, clipId: string) {
    const clip = await this.getClipForUser(userId, clipId);

    return this.prisma.clip.update({
      where: { id: clip.id },
      data: { deletedAt: new Date() },
    });
  }

  private async getPersonalFolder(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    return folder;
  }

  private async getClipForUser(userId: string, clipId: string) {
    const clip = await this.prisma.clip.findFirst({
      where: {
        id: clipId,
        deletedAt: null,
        workspace: {
          ownerUserId: userId,
          type: WorkspaceType.PERSONAL,
        },
      },
      select: {
        id: true,
        type: true,
        folderId: true,
        workspaceId: true,
        title: true,
        textContent: true,
        colorHex: true,
        imageUrl: true,
      },
    });

    if (!clip) {
      throw new NotFoundException('클립을 찾을 수 없습니다.');
    }

    return clip;
  }

  private resolveClipData(
    text: string | undefined,
    file?: Express.Multer.File,
  ) {
    if (file) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('이미지 파일만 업로드할 수 있습니다.');
      }

      return {
        type: ClipType.IMAGE,
        title: file.originalname,
        textContent: null,
        colorHex: null,
        // 저장소 연동 전까지는 파일명을 임시 식별자로 저장한다.
        imageUrl: file.originalname,
      };
    }

    if (!text) {
      throw new BadRequestException('text 또는 file 중 하나는 필요합니다.');
    }

    return this.toClipData(detectClipType(text));
  }

  private toClipData(detected: DetectedClip) {
    if (detected.type === 'COLOR') {
      return {
        type: ClipType.COLOR,
        title: detected.hex,
        textContent: null,
        colorHex: detected.hex,
        imageUrl: null,
      };
    }

    if (detected.type === 'IMAGE') {
      return {
        type: ClipType.IMAGE,
        title: detected.imageUrl,
        textContent: null,
        colorHex: null,
        imageUrl: detected.imageUrl,
      };
    }

    if (detected.text.length === 0) {
      throw new BadRequestException('text는 공백일 수 없습니다.');
    }

    return {
      type: ClipType.TEXT,
      title: detected.text,
      textContent: detected.text,
      colorHex: null,
      imageUrl: null,
    };
  }
}
