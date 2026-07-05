import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  SendSubscriptionPaymentSuccessMailInput,
  SubscriptionPaymentMailPort,
} from '../application/ports/subscription-payment-mail.port';

const DEFAULT_SUPPORT_EMAIL = 'support@easy-clip.app';

@Injectable()
export class ResendSubscriptionPaymentMailService implements SubscriptionPaymentMailPort {
  private client: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendPaymentSuccess(
    input: SendSubscriptionPaymentSuccessMailInput,
  ): Promise<void> {
    if (!this.isMailEnabled()) {
      return;
    }

    const response = await this.getClient().emails.send({
      from: this.getRequired('MAIL_FROM_ADDRESS'),
      to: input.recipientEmail,
      subject: this.buildSubject(input),
      text: this.buildText(input),
      html: this.buildHtml(input),
      tags: [
        {
          name: 'category',
          value: 'subscription-payment-success',
        },
        {
          name: 'payment_kind',
          value: input.paymentKind.toLowerCase(),
        },
      ],
    });

    if (response.error) {
      throw new Error(
        `Resend payment success mail failed: ${response.error.name}(${response.error.statusCode})`,
      );
    }
  }

  private isMailEnabled(): boolean {
    // 실제 메일 발송은 side effect가 크므로 환경변수로 명시적으로 켠 경우에만 수행한다.
    return this.configService.get<string>('MAIL_ENABLED') === 'true';
  }

  private getClient(): Resend {
    if (!this.client) {
      this.client = new Resend(this.getRequired('RESEND_API_KEY'));
    }

    return this.client;
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(`${key} 환경 변수가 필요합니다.`);
    }

    return value;
  }

  private buildSubject(input: SendSubscriptionPaymentSuccessMailInput): string {
    return input.paymentKind === 'INITIAL'
      ? 'Easy Clip PRO 구독 결제가 완료되었습니다'
      : 'Easy Clip PRO 구독 자동결제가 완료되었습니다';
  }

  private buildText(input: SendSubscriptionPaymentSuccessMailInput): string {
    const supportEmail =
      this.configService.get<string>('MAIL_SUPPORT_EMAIL') ??
      DEFAULT_SUPPORT_EMAIL;

    return [
      '안녕하세요. Easy Clip입니다.',
      '',
      `${this.resolvePaymentLabel(input)}가 정상적으로 완료되었습니다.`,
      '',
      `구독 플랜: ${input.plan}`,
      `결제 금액: ${this.formatAmount(input.amount, input.currency)}`,
      `승인 시각: ${this.formatDateTime(input.approvedAt)}`,
      `현재 이용 기간 종료일: ${this.formatDate(input.currentPeriodEnd)}`,
      `다음 결제 예정일: ${this.formatDate(input.nextBillingAt)}`,
      '',
      `문의가 필요하시면 ${supportEmail}로 연락해주세요.`,
      '',
      'Easy Clip 드림',
    ].join('\n');
  }

  private buildHtml(input: SendSubscriptionPaymentSuccessMailInput): string {
    const supportEmail = escapeHtml(
      this.configService.get<string>('MAIL_SUPPORT_EMAIL') ??
        DEFAULT_SUPPORT_EMAIL,
    );
    const title = escapeHtml(this.resolvePaymentLabel(input));

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
  </head>
  <body style="margin:0;background-color:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f8fb" style="width:100%;background-color:#f6f8fb;">
      <tr>
        <td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding-top:28px;padding-right:28px;padding-bottom:12px;padding-left:28px;">
                <p style="margin:0;font-size:14px;line-height:20px;color:#4b5563;">Easy Clip</p>
                <h1 style="margin-top:8px;margin-right:0;margin-bottom:0;margin-left:0;font-size:24px;line-height:32px;color:#111827;font-weight:700;">${title}가 완료되었습니다</h1>
              </td>
            </tr>
            <tr>
              <td style="padding-top:8px;padding-right:28px;padding-bottom:28px;padding-left:28px;">
                ${this.buildHtmlRow('구독 플랜', input.plan)}
                ${this.buildHtmlRow('결제 금액', this.formatAmount(input.amount, input.currency))}
                ${this.buildHtmlRow('승인 시각', this.formatDateTime(input.approvedAt))}
                ${this.buildHtmlRow('현재 이용 기간 종료일', this.formatDate(input.currentPeriodEnd))}
                ${this.buildHtmlRow('다음 결제 예정일', this.formatDate(input.nextBillingAt))}
              </td>
            </tr>
            <tr>
              <td bgcolor="#f9fafb" style="padding-top:18px;padding-right:28px;padding-bottom:18px;padding-left:28px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#4b5563;">문의가 필요하시면 ${supportEmail}로 연락해주세요.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildHtmlRow(label: string, value: string): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-bottom:1px solid #eef2f7;">
  <tr>
    <td style="padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:0;font-size:14px;line-height:20px;color:#6b7280;">${escapeHtml(label)}</td>
    <td align="right" style="padding-top:12px;padding-right:0;padding-bottom:12px;padding-left:12px;font-size:14px;line-height:20px;color:#111827;font-weight:600;">${escapeHtml(value)}</td>
  </tr>
</table>`;
  }

  private resolvePaymentLabel(
    input: SendSubscriptionPaymentSuccessMailInput,
  ): string {
    return input.paymentKind === 'INITIAL' ? '구독 결제' : '구독 자동결제';
  }

  private formatAmount(amount: number, currency: string): string {
    if (currency === 'KRW') {
      return `${amount.toLocaleString('ko-KR')}원`;
    }

    return `${amount.toLocaleString('ko-KR')} ${currency}`;
  }

  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
    }).format(value);
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
