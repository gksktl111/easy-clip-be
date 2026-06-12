export type AuthSessionOutput = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};
