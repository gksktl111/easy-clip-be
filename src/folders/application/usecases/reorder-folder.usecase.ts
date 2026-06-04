import { Inject, Injectable } from '@nestjs/common';
import { FOLDERS_REPOSITORY } from '../../domain/folders.repository';
import type { FoldersRepository } from '../../domain/folders.repository';
import { FoldersError } from '../errors/folders.error';
import {
  calculateReorderedFolderOrder,
  resolveReferenceId,
  validateReorderFolderInput,
} from '../policies/reorder-folder.policy';

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
    const { targetId, beforeId } = input;
    validateReorderFolderInput(input);

    const target = await this.foldersRepository.findPersonalFolderById(
      userId,
      targetId,
    );

    if (!target) {
      throw new FoldersError('NOT_FOUND', '이동할 폴더를 찾을 수 없습니다.');
    }

    const referenceId = resolveReferenceId(input);
    const reference = await this.foldersRepository.findFolderByIdInWorkspace(
      referenceId,
      target.workspaceId,
    );

    if (!reference) {
      throw new FoldersError('NOT_FOUND', '기준 폴더를 찾을 수 없습니다.');
    }

    const previousOrder = beforeId
      ? await this.foldersRepository.findPreviousFolderOrder({
          workspaceId: target.workspaceId,
          referenceOrder: reference.order,
          excludeId: target.id,
        })
      : null;
    const nextOrder = beforeId
      ? null
      : await this.foldersRepository.findNextFolderOrder({
          workspaceId: target.workspaceId,
          referenceOrder: reference.order,
          excludeId: target.id,
        });
    const newOrder = calculateReorderedFolderOrder({
      target,
      reference,
      beforeId,
      previousOrder,
      nextOrder,
    });

    if (newOrder === target.order) {
      return (await this.foldersRepository.findFolderById(target.id)) ?? target;
    }

    return this.foldersRepository.updateFolderOrder(target.id, newOrder);
  }
}
