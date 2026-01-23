export class FolderEntity {
  id: string;
  name: string;
  order: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
