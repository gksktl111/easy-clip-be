import { AuthRepository } from '../../domain/auth.repository';
import { AuthError } from '../auth.error';
import { OAuthSignInResult } from '../auth.types';
import { AuthPlatform } from '../../domain/auth.types';
import { issueAuthResult } from '../policies/auth-result.policy';

export class SwitchUserUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(
    currentUserId: string,
    targetAuthAccountId: string,
    platform: AuthPlatform,
  ): Promise<OAuthSignInResult> {
    const targetAccount =
      await this.authRepository.findAccountById(targetAuthAccountId);

    if (!targetAccount) {
      throw new AuthError('NOT_FOUND', '전환할 계정을 찾을 수 없습니다.');
    }

    if (targetAccount.userId !== currentUserId) {
      throw new AuthError('FORBIDDEN', '연동되지 않은 계정입니다.');
    }

    return issueAuthResult(this.authRepository, {
      userId: targetAccount.userId,
      account: targetAccount,
      platform,
    });
  }
}
