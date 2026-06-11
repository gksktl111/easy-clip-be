import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { UpdateMeInput } from '../dtos/update-me-input.dto';
import { UserProfileOutput } from '../dtos/user-profile-output.dto';
import { mapMeResponse } from '../helpers/map-me-response.helper';
import { UsersError } from '../errors/users.error';
import {
  buildUpdateMeParams,
  resolveCurrentAuthAccount,
} from '../helpers/update-me.helper';

@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(
    userId: string,
    accountId: string,
    input: UpdateMeInput,
  ): Promise<UserProfileOutput> {
    const user = await this.usersRepository.findUserWithAuthAccounts(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    resolveCurrentAuthAccount(user, accountId);
    const updateParams = buildUpdateMeParams(input);

    if (Object.keys(updateParams).length === 0) {
      return mapMeResponse(user, accountId);
    }

    const updatedAccount = await this.usersRepository.updateAuthAccountProfile(
      accountId,
      updateParams,
    );

    const mergedUser = {
      ...user,
      authAccounts: user.authAccounts.map((item) =>
        item.id === accountId ? updatedAccount : item,
      ),
    };

    return mapMeResponse(mergedUser, accountId);
  }
}
