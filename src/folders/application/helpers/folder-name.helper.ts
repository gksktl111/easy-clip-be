import { isValidTagName } from '../../../shared/application/tag-name.helper';
import { normalizeBoundedName } from '../../../shared/application/name-normalization.helper';
import { FOLDER_NAME_MAX_LENGTH } from '../constants/folder-name.constants';
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
  if (!isValidTagName(name)) {
    throw new FoldersError(
      'BAD_REQUEST',
      '태그명은 공백만으로 구성할 수 없으며 공백을 포함해 10자 이하여야 합니다.',
    );
  }

  return name;
}
