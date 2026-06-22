import { ApiProperty } from '@nestjs/swagger';

export class MySubscriptionResponseDto {
  @ApiProperty({ enum: ['FREE', 'PRO'], example: 'FREE' })
  plan: 'FREE' | 'PRO';

  @ApiProperty({ enum: ['ACTIVE', 'CANCELED', 'EXPIRED'], example: 'ACTIVE' })
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED';

  @ApiProperty({ example: false })
  autoRenew: boolean;

  @ApiProperty({ example: null, nullable: true })
  currentPeriodEnd: Date | null;

  @ApiProperty({ example: null, nullable: true })
  nextBillingAt: Date | null;

  @ApiProperty({ enum: ['TOSS_PAYMENTS'], example: null, nullable: true })
  provider: 'TOSS_PAYMENTS' | null;
}

export class BillingAuthRequestResponseDto {
  @ApiProperty({ example: 'test_ck_xxxxxxxxx' })
  clientKey: string;

  @ApiProperty({ example: 'easyclip_user-id_uuid' })
  customerKey: string;

  @ApiProperty({ enum: ['CARD'], example: 'CARD' })
  method: 'CARD';

  @ApiProperty({ example: 'http://localhost:3001/billing/success' })
  successUrl: string;

  @ApiProperty({ example: 'http://localhost:3001/billing/fail' })
  failUrl: string;
}

export class ProcessDueAutoRenewalsResponseDto {
  @ApiProperty({ example: 3 })
  processed: number;

  @ApiProperty({ example: 2 })
  succeeded: number;

  @ApiProperty({ example: 1 })
  failed: number;
}
