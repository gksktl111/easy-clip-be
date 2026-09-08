import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class SubscriptionCancellationResponseDto {
  @ApiProperty({
    description: '이미 시작되어 아직 결과가 확정되지 않은 자동결제 유무',
  })
  pendingRenewalPayment: boolean;

  @ApiProperty({ description: '해지와 진행 중 결제에 대한 안내' })
  message: string;
}

export class UpdateMySubscriptionResponseDto extends MySubscriptionResponseDto {
  @ApiPropertyOptional({
    type: SubscriptionCancellationResponseDto,
    description: '해지 요청 성공 시 제공하며, 결과 시점의 스냅샷입니다.',
  })
  cancellation?: SubscriptionCancellationResponseDto;
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

export class PaymentReconciliationResponseDto {
  @ApiProperty({ example: 1 })
  processed: number;

  @ApiProperty({ example: 1 })
  succeeded: number;

  @ApiProperty({ example: 0 })
  deferred: number;

  @ApiProperty({ example: 0 })
  manualReview: number;
}

export class ProcessDueAutoRenewalsResponseDto {
  @ApiProperty({ example: 3 })
  processed: number;

  @ApiProperty({ example: 2 })
  succeeded: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiProperty({ type: PaymentReconciliationResponseDto })
  reconciliation: PaymentReconciliationResponseDto;
}
