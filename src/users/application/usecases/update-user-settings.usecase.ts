import { Theme } from '@prisma/client';
import { UsersRepository } from '../../domain/users.repository';
import { UsersError } from '../users.error';

export type UpdateUserSettingsInput = {
  theme?: Theme;
  language?: string;
};

export class UpdateUserSettingsUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

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
