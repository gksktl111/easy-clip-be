export class UserDto {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
}
