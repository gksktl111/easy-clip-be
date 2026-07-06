import { RestoreTrashItem } from '../../domain/trash.types';

export type DeleteTrashItemsInput = {
  items: RestoreTrashItem[];
};

export type DeleteTrashItemsOutput = {
  clipsDeleted: number;
  foldersDeleted: number;
  totalDeleted: number;
};
