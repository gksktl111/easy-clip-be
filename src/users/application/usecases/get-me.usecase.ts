import { UsersRepository } from '../../domain/users.repository';
import { mapMeResponse } from '../policies/map-me-response.policy';
import { UsersError } from '../users.error';

export class GetMeUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(userId: string, accountId: string) {
    const user = await this.usersRepository.findUserWithAuthAccounts(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    return mapMeResponse(user, accountId);
  }
}
