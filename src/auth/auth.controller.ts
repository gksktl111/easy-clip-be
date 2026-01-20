import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  // Record<string, any> 타입은 임시로 사용한 것으로, 실제로는 DTO를 정의하는 것이 좋습니다.
  signUp(@Body() signUpDto: Record<string, any>) {
    return this.authService.signUp(
      signUpDto.username,
      signUpDto.password,
      signUpDto.email,
    );
  }

  @Post('login')
  // Record<string, any> 타입은 임시로 사용한 것으로, 실제로는 DTO를 정의하는 것이 좋습니다.
  signIn(@Body() signInDto: Record<string, any>) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
