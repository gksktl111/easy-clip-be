import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsError } from '../application/errors/subscriptions.error';
import {
  BillingPaymentGateway,
  ChargeBillingParams,
  ChargeBillingResult,
  IssueBillingKeyParams,
  IssueBillingKeyResult,
  LookupBillingPaymentResult,
} from '../application/ports/billing-payment.gateway';

type TossBillingKeyResponse = {
  billingKey: string;
  authenticatedAt: string;
  method: string;
};

type TossPaymentResponse = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  approvedAt?: string | null;
  failure?: {
    code?: string;
    message?: string;
  } | null;
};

@Injectable()
export class TossPaymentsBillingGateway implements BillingPaymentGateway {
  private readonly baseUrl = 'https://api.tosspayments.com';

  constructor(private readonly configService: ConfigService) {}

  async issueBillingKey(
    params: IssueBillingKeyParams,
  ): Promise<IssueBillingKeyResult> {
    const response = await this.request<TossBillingKeyResponse>(
      '/v1/billing/authorizations/issue',
      {
        authKey: params.authKey,
        customerKey: params.customerKey,
      },
    );

    return {
      billingKey: response.billingKey,
      authenticatedAt: new Date(response.authenticatedAt),
      method: response.method,
      rawData: response,
    };
  }

  async chargeBilling(
    params: ChargeBillingParams,
  ): Promise<ChargeBillingResult> {
    const response = await this.request<TossPaymentResponse>(
      `/v1/billing/${encodeURIComponent(params.billingKey)}`,
      {
        customerKey: params.customerKey,
        amount: params.amount,
        orderId: params.orderId,
        orderName: params.orderName,
        currency: params.currency,
      },
      params.timeoutMs === undefined
        ? undefined
        : AbortSignal.timeout(params.timeoutMs),
    );

    return {
      paymentKey: response.paymentKey,
      orderId: response.orderId,
      status: response.status === 'DONE' ? 'DONE' : 'FAILED',
      totalAmount: response.totalAmount,
      currency: response.currency,
      approvedAt: response.approvedAt ? new Date(response.approvedAt) : null,
      failureCode: response.failure?.code ?? null,
      failureMessage: response.failure?.message ?? null,
      rawData: response,
    };
  }

  async findPaymentByOrderId(
    orderId: string,
  ): Promise<LookupBillingPaymentResult | null> {
    const response = await fetch(
      `${this.baseUrl}/v1/payments/orders/${encodeURIComponent(orderId)}`,
      {
        method: 'GET',
        headers: this.getRequestHeaders(),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const data = (await response.json()) as TossPaymentResponse & {
      code?: string;
      message?: string;
    };

    if (response.status === 404 && data.code === 'NOT_FOUND_PAYMENT') {
      return null;
    }

    if (!response.ok) {
      throw new SubscriptionsError(
        'CONFLICT',
        data.message ?? '토스페이먼츠 요청에 실패했습니다.',
      );
    }

    const approvedAt = data.approvedAt ? new Date(data.approvedAt) : null;

    return {
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      totalAmount: data.totalAmount,
      currency: data.currency,
      approvedAt:
        approvedAt && Number.isFinite(approvedAt.getTime()) ? approvedAt : null,
      failureCode: data.failure?.code ?? null,
      failureMessage: data.failure?.message ?? null,
      rawData: data,
    };
  }

  private getRequestHeaders(): Record<string, string> {
    const secretKey = this.configService.get<string>(
      'TOSS_PAYMENTS_SECRET_KEY',
    );

    if (!secretKey) {
      throw new SubscriptionsError(
        'INTERNAL',
        '토스페이먼츠 시크릿 키 설정이 필요합니다.',
      );
    }

    return {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<TResponse>(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      signal,
      headers: this.getRequestHeaders(),
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TResponse & {
      code?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new SubscriptionsError(
        'CONFLICT',
        data.message ?? '토스페이먼츠 요청에 실패했습니다.',
      );
    }

    return data;
  }
}
