import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveProMonthlyPrice } from '../helpers/pro-monthly-price.helper';

@Injectable()
export class GetSubscriptionPriceUseCase {
  constructor(private readonly configService: ConfigService) {}
  execute() {
    return resolveProMonthlyPrice(this.configService);
  }
}
