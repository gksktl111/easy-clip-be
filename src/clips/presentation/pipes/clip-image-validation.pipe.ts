import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { detectClipImageMimeType } from 'src/shared/application/helpers/clip-image-validation.helper';
import type { MulterFile } from 'src/shared/types/multer-file.type';

@Injectable()
export class ClipImageValidationPipe implements PipeTransform {
  transform(file?: MulterFile): MulterFile | undefined {
    if (file && detectClipImageMimeType(file.buffer) !== file.mimetype) {
      throw new BadRequestException(
        '이미지의 실제 파일 형식과 MIME 유형이 일치해야 합니다.',
      );
    }
    return file;
  }
}
