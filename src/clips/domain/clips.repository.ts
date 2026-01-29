import { Clip, ClipType, PersonalFolder } from './clip.types';

export const CLIPS_REPOSITORY = Symbol('CLIPS_REPOSITORY');

export type CreateClipParams = {
  type: ClipType;
  title: string;
  folderId: string;
  workspaceId: string;
  textContent: string | null;
  colorHex: string | null;
  imageUrl: string | null;
};

export type UpdateClipParams = CreateClipParams;

export interface ClipsRepository {
  findPersonalFolderById(
    userId: string,
    folderId: string,
  ): Promise<PersonalFolder | null>;
  findClipByIdForUser(userId: string, clipId: string): Promise<Clip | null>;
  createClip(params: CreateClipParams): Promise<Clip>;
  updateClip(clipId: string, params: UpdateClipParams): Promise<Clip>;
  softDeleteClip(clipId: string): Promise<Clip>;
}
