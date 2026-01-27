import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtPayload } from 'src/auth/auth';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';
import { ClipsService } from './clips.service';
import { CreateClipDto } from './dtos/create-clip.dto';
import { UpdateClipDto } from './dtos/update-clip.dto';

@UseGuards(JwtAccessGuard)
@Controller('clips')
export class ClipsController {
  constructor(private clipsService: ClipsService) {}

  // multipart 입력에서 file 우선 규칙으로 타입을 판별해 클립을 생성한다.
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  createClip(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateClipDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.clipsService.createClip(req.user.sub, dto, file);
  }

  // 삭제되지 않은 내 클립을 단건으로 조회한다.
  @Get(':id')
  getClip(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.clipsService.getClipById(req.user.sub, id);
  }

  // multipart 입력에서 file/text가 주어지면 타입을 재판별해 클립을 갱신한다.
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  updateClip(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateClipDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.clipsService.updateClip(req.user.sub, id, dto, file);
  }

  // 클립을 즉시 제거하지 않고 deletedAt만 기록한다.
  @Delete(':id')
  deleteClip(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.clipsService.deleteClip(req.user.sub, id);
  }
}
