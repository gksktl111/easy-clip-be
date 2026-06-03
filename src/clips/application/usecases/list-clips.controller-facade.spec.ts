/* eslint-disable @typescript-eslint/unbound-method */
import { ListClipsControllerFacade } from './list-clips.controller-facade';
import { ListFavoriteClipsUseCase } from './list-favorite-clips.usecase';
import { ListFolderClipsUseCase } from './list-folder-clips.usecase';
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';

const createFacade = () => {
  const listFolderClips = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<ListFolderClipsUseCase>;
  const listFavoriteClips = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<ListFavoriteClipsUseCase>;
  const listRecentClips = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<ListRecentClipsUseCase>;

  const facade = new ListClipsControllerFacade(
    listFolderClips,
    listFavoriteClips,
    listRecentClips,
  );

  return {
    facade,
    listFolderClips,
    listFavoriteClips,
    listRecentClips,
  };
};

describe('ListClipsControllerFacade', () => {
  it('folderId와 favorite/recent가 동시에 제공되면 BAD_REQUEST를 반환한다', async () => {
    const { facade } = createFacade();

    await expect(
      facade.execute('user-id', {
        folderId: 'folder-id',
        cursor: '',
        type: 'ALL',
        favorite: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      facade.execute('user-id', {
        folderId: 'folder-id',
        cursor: '',
        type: 'ALL',
        recent: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('favorite와 recent가 모두 true이거나 모두 false면 BAD_REQUEST를 반환한다', async () => {
    const { facade } = createFacade();

    await expect(
      facade.execute('user-id', {
        cursor: '',
        type: 'ALL',
        favorite: true,
        recent: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      facade.execute('user-id', {
        cursor: '',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('type이 없으면 BAD_REQUEST를 반환한다', async () => {
    const { facade } = createFacade();

    await expect(
      facade.execute('user-id', {
        cursor: '',
        favorite: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('folderId가 있으면 폴더 클립 유스케이스를 호출한다', async () => {
    const { facade, listFolderClips, listFavoriteClips, listRecentClips } =
      createFacade();
    listFolderClips.execute.mockResolvedValue({ items: [], nextCursor: null });

    await facade.execute('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
      q: 'keyword',
    });

    expect(listFolderClips.execute).toHaveBeenCalledWith('user-id', {
      folderId: 'folder-id',
      cursor: '',
      type: 'ALL',
      q: 'keyword',
    });
    expect(listFavoriteClips.execute).not.toHaveBeenCalled();
    expect(listRecentClips.execute).not.toHaveBeenCalled();
  });

  it('favorite가 true면 좋아요 클립 유스케이스를 호출한다', async () => {
    const { facade, listFolderClips, listFavoriteClips, listRecentClips } =
      createFacade();
    listFavoriteClips.execute.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });

    await facade.execute('user-id', {
      cursor: undefined,
      type: 'ALL',
      favorite: true,
    });

    expect(listFavoriteClips.execute).toHaveBeenCalledWith('user-id', {
      cursor: undefined,
      type: 'ALL',
      q: undefined,
    });
    expect(listFolderClips.execute).not.toHaveBeenCalled();
    expect(listRecentClips.execute).not.toHaveBeenCalled();
  });

  it('recent가 true면 최근 클립 유스케이스를 호출한다', async () => {
    const { facade, listFolderClips, listFavoriteClips, listRecentClips } =
      createFacade();
    listRecentClips.execute.mockResolvedValue({ items: [], nextCursor: null });

    await facade.execute('user-id', {
      cursor: '',
      type: 'ALL',
      recent: true,
    });

    expect(listRecentClips.execute).toHaveBeenCalledWith('user-id', {
      cursor: '',
      type: 'ALL',
      q: undefined,
    });
    expect(listFolderClips.execute).not.toHaveBeenCalled();
    expect(listFavoriteClips.execute).not.toHaveBeenCalled();
  });
});
