import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class ConfirmBillingAuthDto {
  @ApiProperty({
    description:
      'Client-generated UUID reused for all retries of this payment.',
  })
  @IsUUID('4')
  idempotencyKey: string;

  @ApiProperty({ description: 'priceVersion from the displayed server price.' })
  @IsString()
  @IsNotEmpty()
  priceVersion: string;

  @ApiProperty({
    example: 'authKey_from_toss_success_redirect',
    description:
      '토스페이먼츠 requestBillingAuth 성공 리다이렉트 URL의 authKey 쿼리 값입니다.',
  })
  @IsString()
  authKey: string;

  @ApiProperty({
    example: 'POST /subscriptions/me/billing-auth/request 응답의 customerKey',
    description:
      'POST /subscriptions/me/billing-auth/request 응답으로 받은 customerKey와 토스페이먼츠 성공 리다이렉트의 customerKey가 일치해야 합니다.',
  })
  @IsString()
  customerKey: string;
}
