export const AuthProvider = {
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];
