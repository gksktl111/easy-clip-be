import { PrismaUsersRepository } from './prisma-users.repository';

describe('PrismaUsersRepository', () => {
  it('회원 탈퇴 시 refresh token을 먼저 삭제한 뒤 사용자 row를 삭제한다', async () => {
    const tx = {
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      workspace: {
        findMany: jest.fn().mockResolvedValue([{ id: 'workspace-id' }]),
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (args: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as never;

    const repository = new PrismaUsersRepository(prisma);

    await repository.deleteUserAndOwnedPersonalWorkspaces('user-id');

    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
      },
    });
    expect(tx.workspace.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['workspace-id'],
        },
      },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-id' },
    });
    expect(tx.refreshToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.delete.mock.invocationCallOrder[0],
    );
  });
});
