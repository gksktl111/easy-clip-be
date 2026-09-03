import {
  DEFAULT_TAG_BACKGROUND_COLOR,
  isTagBackgroundColor,
  type TagBackgroundColor,
} from 'src/shared/application/tag-background-color.helper';
import { FoldersError } from '../errors/folders.error';

export function resolveFolderTagBackgroundColor(
  value: unknown,
  defaultValue = DEFAULT_TAG_BACKGROUND_COLOR,
): TagBackgroundColor {
  const backgroundColor = value ?? defaultValue;

  if (!isTagBackgroundColor(backgroundColor)) {
    throw new FoldersError('BAD_REQUEST', '지원하지 않는 태그 배경색입니다.');
  }

  return backgroundColor;
}
