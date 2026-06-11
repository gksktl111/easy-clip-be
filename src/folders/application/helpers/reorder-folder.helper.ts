import { Folder } from '../../domain/folder.types';
import { FoldersError } from '../errors/folders.error';
import { ReorderFolderInput } from '../dtos/reorder-folder-input.dto';

export function validateReorderFolderInput(input: ReorderFolderInput) {
  const { targetId, afterId, beforeId } = input;

  if ((!afterId && !beforeId) || (afterId && beforeId)) {
    throw new FoldersError(
      'BAD_REQUEST',
      'afterId 또는 beforeId 중 하나만 전달해야 합니다.',
    );
  }

  if (targetId === afterId || targetId === beforeId) {
    throw new FoldersError('BAD_REQUEST', '이동 대상과 기준 폴더가 같습니다.');
  }
}

export function resolveReferenceId(input: ReorderFolderInput): string {
  const referenceId = input.afterId ?? input.beforeId;

  if (!referenceId) {
    throw new FoldersError('BAD_REQUEST', '기준 폴더가 필요합니다.');
  }

  return referenceId;
}

export function calculateReorderedFolderOrder(params: {
  target: Folder;
  reference: Pick<Folder, 'order'>;
  beforeId?: string;
  previousOrder: number | null;
  nextOrder: number | null;
}): number {
  if (params.beforeId) {
    return params.previousOrder
      ? (params.previousOrder + params.reference.order) / 2
      : params.reference.order - 1;
  }

  return params.nextOrder
    ? (params.reference.order + params.nextOrder) / 2
    : params.reference.order + 1;
}
