import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { UserSettingsOutput } from '../dtos/user-settings-output.dto';
import { UsersError } from '../errors/users.error';

@Injectable()
export class GetUserSettingsUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string): Promise<UserSettingsOutput> {
    const user = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    return this.usersRepository.upsertUserSettings(userId, {});
  }
}
