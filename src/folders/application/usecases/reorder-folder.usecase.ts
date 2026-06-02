import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../errors/folders.error';

export type ReorderFolderInput = {
  targetId: string;
  afterId?: string;
  beforeId?: string;
};

@Injectable()
export class ReorderFolderUseCase {
  constructor(
    @Inject(FOLDERS_REPOSITORY)
    private readonly foldersRepository: FoldersRepository,
  ) {}

  async execute(userId: string, input: ReorderFolderInput) {
    const { targetId, afterId, beforeId } = input;

    if ((!afterId && !beforeId) || (afterId && beforeId)) {
      throw new FoldersError(
        'BAD_REQUEST',
        'afterId 또는 beforeId 중 하나만 전달해야 합니다.',
      );
    }

    if (targetId === afterId || targetId === beforeId) {
      throw new FoldersError(
        'BAD_REQUEST',
        '이동 대상과 기준 폴더가 같습니다.',
      );
    }

    const target = await this.foldersRepository.findPersonalFolderById(
      userId,
      targetId,
    );

    if (!target) {
      throw new FoldersError('NOT_FOUND', '이동할 폴더를 찾을 수 없습니다.');
    }

    const referenceId = afterId ?? beforeId;

    if (!referenceId) {
      throw new FoldersError('BAD_REQUEST', '기준 폴더가 필요합니다.');
    }

    const reference = await this.foldersRepository.findFolderByIdInWorkspace(
      referenceId,
      target.workspaceId,
    );

    if (!reference) {
      throw new FoldersError('NOT_FOUND', '기준 폴더를 찾을 수 없습니다.');
    }

    let newOrder: number;

    if (beforeId) {
      const previousOrder =
        await this.foldersRepository.findPreviousFolderOrder({
          workspaceId: target.workspaceId,
          referenceOrder: reference.order,
          excludeId: target.id,
        });

      newOrder = previousOrder
        ? (previousOrder + reference.order) / 2
        : reference.order - 1;
    } else {
      const nextOrder = await this.foldersRepository.findNextFolderOrder({
        workspaceId: target.workspaceId,
        referenceOrder: reference.order,
        excludeId: target.id,
      });

      newOrder = nextOrder
        ? (reference.order + nextOrder) / 2
        : reference.order + 1;
    }

    if (newOrder === target.order) {
      return (await this.foldersRepository.findFolderById(target.id)) ?? target;
    }

    return this.foldersRepository.updateFolderOrder(target.id, newOrder);
  }
}
