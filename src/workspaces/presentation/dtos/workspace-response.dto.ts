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
}
