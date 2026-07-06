import {
  Controller,
  Delete,
  Get,
  Body,
  Patch,
  Query,
  Request,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { DeleteAllTrashItemsUseCase } from '../application/usecases/delete-all-trash-items.usecase';
import { DeleteTrashItemsUseCase } from '../application/usecases/delete-trash-items.usecase';
import { ListTrashItemsUseCase } from '../application/usecases/list-trash-items.usecase';
import { RestoreTrashItemsUseCase } from '../application/usecases/restore-trash-items.usecase';
import { ListTrashQueryDto } from './dtos/list-trash-query.dto';
import { DeleteTrashItemsDto } from './dtos/delete-trash-items.dto';
import { RestoreTrashItemsDto } from './dtos/restore-trash-items.dto';
import {
  TrashDeleteAllResponseDto,
  TrashListResponseDto,
  TrashRestoreResponseDto,
} from './dtos/trash-response.dto';

@Controller('trash')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Trash')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class TrashController {
  constructor(
    private readonly listTrashItemsUseCase: ListTrashItemsUseCase,
    private readonly restoreTrashItemsUseCase: RestoreTrashItemsUseCase,
    private readonly deleteTrashItemsUseCase: DeleteTrashItemsUseCase,
    private readonly deleteAllTrashItemsUseCase: DeleteAllTrashItemsUseCase,
  ) {}

  @Delete()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 전체 영구 삭제' })
  @ApiOkResponse({
    description: '휴지통 전체 삭제 결과를 반환합니다.',
    type: TrashDeleteAllResponseDto,
  })
  deleteAllTrashItems(@Request() req: { user: AuthContext }) {
    return this.deleteAllTrashItemsUseCase.execute(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 전체 목록 조회' })
  @ApiOkResponse({
    description: '삭제된 클립과 폴더 목록을 함께 반환합니다.',
    type: TrashListResponseDto,
  })
  getTrashItems(
    @Request() req: { user: AuthContext },
    @Query() query: ListTrashQueryDto,
  ) {
    return this.listTrashItemsUseCase.execute(req.user.userId, query);
  }

  @Patch('restore')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 항목 복구' })
  @ApiOkResponse({
    description: '복구된 휴지통 항목 수를 반환합니다.',
    type: TrashRestoreResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 항목을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: '삭제된 폴더에 속한 클립은 단독으로 복구할 수 없습니다.',
    type: ErrorResponseDto,
  })
  restoreTrashItems(
    @Request() req: { user: AuthContext },
    @Body() body: RestoreTrashItemsDto,
  ) {
    return this.restoreTrashItemsUseCase.execute(req.user.userId, body);
  }

  @Delete('items')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '휴지통 항목 영구 삭제' })
  @ApiOkResponse({
    description: '영구 삭제된 휴지통 항목 수를 반환합니다.',
    type: TrashDeleteAllResponseDto,
  })
  @ApiNotFoundResponse({
    description: '휴지통 항목을 찾을 수 없습니다.',
    type: ErrorResponseDto,
  })
  deleteTrashItems(
    @Request() req: { user: AuthContext },
    @Body() body: DeleteTrashItemsDto,
  ) {
    return this.deleteTrashItemsUseCase.execute(req.user.userId, body);
  }
}
