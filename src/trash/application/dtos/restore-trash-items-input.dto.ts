import { RestoreTrashItem } from '../../domain/trash.types';

export type RestoreTrashItemsInput = {
  items: RestoreTrashItem[];
};

export type RestoreTrashItemsOutput = {
  restoredCount: number;
};
