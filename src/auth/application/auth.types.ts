// src/auth/application/auth.types.ts

export type OAuthSignInResult = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type AccessTokenResult = {
  access_token: string;
};

export type LogoutResult = {
  success: true;
};
