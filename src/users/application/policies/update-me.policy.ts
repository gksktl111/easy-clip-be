import { UpdateAuthAccountProfileParams } from '../../domain/users.repository';
import { UserAuthAccount, UserWithAuthAccounts } from '../../domain/user.types';
import { UsersError } from '../errors/users.error';
import { UpdateMeInput } from '../usecases/update-me.usecase';

export function resolveCurrentAuthAccount(
  user: UserWithAuthAccounts,
  accountId: string,
): UserAuthAccount {
  const account = user.authAccounts.find((item) => item.id === accountId);

  if (!account) {
    throw new UsersError('NOT_FOUND', '계정 정보를 찾을 수 없습니다.');
  }

  return account;
}

export function buildUpdateMeParams(
  input: UpdateMeInput,
): UpdateAuthAccountProfileParams {
  if (input.displayName === null) {
    throw new UsersError('BAD_REQUEST', 'displayName은 null일 수 없습니다.');
  }

  const params: UpdateAuthAccountProfileParams = {};

  if (input.displayName !== undefined) {
    params.displayName = input.displayName;
  }

  if (input.avatarUrl !== undefined) {
    params.profileImageUrl = input.avatarUrl;
  }

  return params;
}
