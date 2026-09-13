export const OAUTH_STATE_STORE = Symbol('OAUTH_STATE_STORE');

export interface OAuthStateStore {
  issue(id: string, expiresAt: Date): Promise<void>;
  consume(id: string, now: Date): Promise<boolean>;
}
