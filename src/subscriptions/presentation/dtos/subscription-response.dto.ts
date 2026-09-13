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

export class SubscriptionPriceResponseDto {
  @ApiProperty({ enum: ['PRO'] })
  plan: 'PRO';

  @ApiProperty({
    description:
      '운영자가 명시한 월간 청구 금액. 판매 가격은 예시로 고정하지 않습니다.',
  })
  amount: number;

  @ApiProperty({ enum: ['KRW'] })
  currency: 'KRW';

  @ApiProperty({ enum: ['MONTH'] })
  interval: 'MONTH';

  @ApiProperty({ enum: [1] })
  intervalCount: 1;

  @ApiProperty({ description: '확인 요청 시 전달할 불투명 가격 버전' })
  priceVersion: string;
}

export class BillingAuthRequestResponseDto {
  @ApiProperty({ type: SubscriptionPriceResponseDto })
  price: SubscriptionPriceResponseDto;

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

  @ApiProperty({ example: 0 })
  failed: number;

  @ApiProperty({ example: 0 })
  skipped: number;
}

export class InitialPaymentReconciliationResponseDto {
  @ApiProperty()
  processed: number;

  @ApiProperty()
  pending: number;
}

export class ProcessDueAutoRenewalsResponseDto {
  @ApiProperty({ type: InitialPaymentReconciliationResponseDto })
  initialReconciliation: InitialPaymentReconciliationResponseDto;

  @ApiProperty({ example: 3 })
  processed: number;

  @ApiProperty({ example: 2 })
  succeeded: number;

  @ApiProperty({ example: 1 })
  failed: number;

  @ApiProperty({ example: 0 })
  skipped: number;

  @ApiProperty({ type: PaymentReconciliationResponseDto })
  reconciliation: PaymentReconciliationResponseDto;
}

export class InitialPaymentResponseDto {
  @ApiProperty({
    nullable: true,
    description: '저장된 결제 시도 ID. 즉시 청구 없는 자동갱신 재개는 null.',
  })
  attemptId: string | null;

  @ApiProperty({ enum: ['PENDING', 'DONE', 'FAILED', 'CANCELED'] })
  status: 'PENDING' | 'DONE' | 'FAILED' | 'CANCELED';

  @ApiPropertyOptional()
  amount?: number;

  @ApiPropertyOptional()
  currency?: string;

  @ApiPropertyOptional()
  priceVersion?: string;

  @ApiPropertyOptional({
    type: MySubscriptionResponseDto,
    description:
      '이번 호출로 구독을 반영한 경우 제공. 최신 구독은 GET /subscriptions/me 조회.',
  })
  subscription?: MySubscriptionResponseDto;
}
