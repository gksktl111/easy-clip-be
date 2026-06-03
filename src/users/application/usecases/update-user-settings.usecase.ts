import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import type { UserTheme } from '../../domain/user.types';
import { UsersError } from '../errors/users.error';

export type UpdateUserSettingsInput = {
  theme?: UserTheme;
  language?: string;
};

@Injectable()
export class UpdateUserSettingsUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string, input: UpdateUserSettingsInput) {
    const user = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    return this.usersRepository.upsertUserSettings(userId, {
      theme: input.theme,
      language: input.language,
    });
  }
}
