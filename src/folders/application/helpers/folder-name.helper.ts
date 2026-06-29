import { normalizeBoundedName } from '../../../shared/application/name-normalization.helper';
import {
  FOLDER_NAME_MAX_LENGTH,
  FOLDER_TAG_NAME_MAX_LENGTH,
} from '../constants/folder-name.constants';
import { FoldersError } from '../errors/folders.error';

export function normalizeFolderName(name: string): string {
  const result = normalizeBoundedName(name, FOLDER_NAME_MAX_LENGTH);

  if (!result.ok) {
    throw new FoldersError(
      'BAD_REQUEST',
      `폴더명은 1자 이상 ${FOLDER_NAME_MAX_LENGTH}자 이하여야 합니다.`,
    );
  }

  return result.value;
}

export function normalizeFolderTagName(name: string): string {
  const result = normalizeBoundedName(name, FOLDER_TAG_NAME_MAX_LENGTH);

  if (!result.ok) {
    throw new FoldersError(
      'BAD_REQUEST',
      `태그명은 1자 이상 ${FOLDER_TAG_NAME_MAX_LENGTH}자 이하여야 합니다.`,
    );
  }

  return result.value;
}
