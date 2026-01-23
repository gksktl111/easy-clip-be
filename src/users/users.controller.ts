import {
  Controller,
  Get,
  NotFoundException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAccessGuard)
  getMe(@Request() req) {
    return this.usersService.getMe(req.user.sub, req.user.accountId);
  }
}
