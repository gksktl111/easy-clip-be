# P1 가격·인증·결제 API 계약 · FE 전달용

2026-09-13, [BE 이슈 #161](https://github.com/gksktl111/easy-clip-be/issues/161), `feat/161` 작업 기준. **아직 배포되지 않은 변경 계약**이다. FE와 BE 적용 순서를 맞춰야 한다.
판매 가격, 가격 인상 고지·동의 방식, 환불·자동갱신 운영 정책은 결정하지 않았다. 아래 금액 타입이나 월간 주기는 기존 결제 구현의 계약이며 판매 조건 확정이 아니다.

## 1. 공개 가격

`GET /subscriptions/pricing` — 인증 불필요, `200`, `Cache-Control: no-store`.

```ts
type ProMonthlyPrice = {
  plan: 'PRO';
  amount: number; // 서버에 명시한 실제 청구 금액, 원 단위 양의 정수
  currency: 'KRW';
  interval: 'MONTH';
  intervalCount: 1;
  priceVersion: string; // 불투명 버전; FE에서 직접 생성하지 않음
};
```

- FE의 하드코딩 금액을 제거하고 이 응답으로 표시한다. 오류 시 임의 금액으로 결제 버튼을 활성화하지 않는다.
- `POST /subscriptions/me/billing-auth/request`의 기존 `clientKey`, `customerKey`, `method`, `successUrl`, `failUrl`에 **`price: ProMonthlyPrice`**가 추가된다. 공개 페이지와 동일한 가격 공급원을 사용한다.
- 최초 청구와 새 자동갱신 시도는 공통 `PRO_MONTHLY_AMOUNT` 설정을 사용한다. 설정 누락·잘못된 양의 정수·지원하지 않는 통화는 가격 조회/인증 요청에서 `500`이며 새 청구는 진행하지 않는다. 이전 `4900` fallback은 제거했다. 테스트의 금액은 판매 가격이 아니다.
- FE는 실제로 사용자에게 표시한 `priceVersion`을 confirm에 전달한다. 아직 저장되지 않은 시도에서 서버 가격이 달라졌으면 **409**, 결제사 호출 없이 거부한다. 가격을 다시 조회·표시하고 사용자 확인 후 진행한다.
- 이미 저장된 시도의 재시도·대사는 저장된 금액·통화로만 검증한다. 설정 변경 후에도 같은 주문의 금액을 바꾸지 않는다.
- 기존 자동갱신은 시도 생성 시점의 설정을 읽는 동작을 유지한다. 따라서 **설정 수정 자체가 다음 신규 청구에 영향을 준다.** 기존 고객 가격 유지/인상 고지·동의/시행일 정책을 먼저 결정해야 하며, 이 변경만으로 운영 가격 인상을 승인하지 않는다. API 인스턴스 사이 설정도 일치시킨다.

## 2. 최초 결제와 결과 복구

`POST /subscriptions/me/billing-auth/confirm` — 인증 필요. 기존 `authKey`, `customerKey`에 필수 필드 두 개를 추가한다.

```ts
type ConfirmBillingAuth = {
  authKey: string;
  customerKey: string;
  idempotencyKey: string; // FE에서 crypto.randomUUID()로 생성한 UUID v4
  priceVersion: string; // 표시한 price.priceVersion
};

type InitialPaymentResult = {
  attemptId: string | null;
  status: 'PENDING' | 'DONE' | 'FAILED' | 'CANCELED';
  amount?: number;
  currency?: string;
  priceVersion?: string;
  subscription?: MySubscription; // 기존 GET /subscriptions/me 응답 타입
};
```

**응답이 기존 구독 객체에서 `InitialPaymentResult`로 바뀐다.** Nest의 기존 POST 기본값인 **201**을 사용하며, 결과 조회 GET은 200이다. `subscription`은 이번 호출로 구독을 반영했을 때 포함될 수 있으므로 항상 존재한다고 가정하지 않는다. 성공 후 최신 구독은 `GET /subscriptions/me`에서 갱신한다.

| 요청                                                                | 용도                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /subscriptions/me/billing/payments/:idempotencyKey`            | 저장된 본인 결제 시도 조회. 결제사 호출·새 청구 없음. `Cache-Control: no-store`. |
| `POST /subscriptions/me/billing/payments/:idempotencyKey/reconcile` | 결제사에서 기존 주문을 조회하고 검증된 결과만 DB에 반영. 새 청구 없음.           |

FE 처리 순서:

1. 결제 인증을 시작하기 전에 UUID v4를 만들고 표시 가격 버전과 함께 리다이렉트/새로고침 후 복구 가능한 저장소에 보관한다. 같은 결제 흐름의 중복 탭도 동일한 키를 사용한다. `authKey`는 로그·분석 도구에 전달하지 않는다.
2. 인증 성공 후 confirm을 호출한다. 응답 유실·타임아웃은 결제 실패 확정이 아니다. 기존 키로 GET 또는 reconcile을 호출한다. confirm 재호출도 동일한 키를 유지한다.
3. `PENDING`이면 “결제 결과 확인 중”으로 표시하고 새 UUID로 다시 결제를 시작하지 않는다. `DONE`이면 구독을 새로 조회한다.
4. `FAILED`/`CANCELED`는 확인된 종료 상태다. 사용자가 다시 결제하기로 한 경우에만 새 흐름과 새 키를 사용한다. 같은 키를 재사용하면 이전 시도 결과가 반환된다.
5. 즉시 청구 없이 유효한 취소 구독을 재개하는 기존 경로는 `attemptId: null`, `status: 'DONE'`, `subscription`을 반환한다. 이후 변경은 기존 구독 조회/해지 API로 처리한다.

| HTTP / 결과   | 의미·FE 대응                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| 400           | 필수 입력·UUID v4 오류 또는 customerKey 불일치. 입력을 수정한다.                                          |
| 401 / 403     | 로그인 필요 또는 쿠키 출처/CSRF 검증 실패. 아래 인증 계약을 적용한다.                                     |
| 404           | 해당 키의 본인 결제 시도가 없음. 다른 사용자의 키도 404.                                                  |
| 409           | 가격 변경, 이미 유효한 PRO 구독, 다른 미확정 결제 등 충돌. 최신 가격·구독·보관 중인 시도 결과를 조회한다. |
| 500           | 설정 또는 시도 저장 전 DB 오류 등. 임의 금액/새 키로 자동 재시도하지 않는다. 기존 키로 조회 후 복구한다.  |
| 201 + PENDING | 시도 저장 이후 결제사/DB 오류 또는 검증 불가능한 결과. 실패로 단정하지 않는다.                            |

오류는 기존 Nest `{ statusCode, message, error }` 형식이다. 결제 409의 세부 원인별 고정 `code` 필드는 이번 계약에 없다. 메시지 문자열을 분기 키로 사용하지 말고 해당 상태를 다시 조회한다.

BE는 구독 행 잠금과 진행 중 시도 유일성으로 같은 키·다른 키·자동갱신과의 경합을 막는다. 결제사 호출 전 시도/가격을 저장하고, 청구 전 빌링키를 저장한다. 결제사의 주문 ID·금액·통화·결제 키·승인 시각을 확인한 뒤 결제 기록과 구독을 한 트랜잭션으로 반영한다.

기존 보호된 `POST /subscriptions/auto-renewals/due` 작업은 기존 인증을 통과한 뒤 최초 결제 대사도 수행한다. 응답에 `initialReconciliation: { processed, pending }`가 추가된다. FE에서 이 운영용 API를 호출하지 않는다. 기존 스케줄러 설정 여부는 운영에서 확인해야 한다.

결제사 조회에서 주문이 없거나, 빌링키 발급 직후 응답/DB 저장이 실패했거나, 검증값이 불일치하면 **PENDING을 유지한다.** 자동 재청구·임의 실패 확정·환불은 하지 않는다. 운영자가 결제사 주문을 확인하고 해결해야 하며, 이번 변경에는 수동 강제 종료 API를 추가하지 않았다.

멱등키의 결제사 측 보조 보호는 [토스페이먼츠 공식 API 안내](https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference)의 POST `Idempotency-Key` 계약을 따른다. 서버의 영속 시도 기록과 조회 복구가 별도로 중복 청구를 막는다.

## 3. 쿠키 인증과 OAuth

쿠키 인증을 사용하는 POST/PATCH/PUT/DELETE 등 상태 변경 요청에는 다음을 적용한다.

```ts
fetch(apiUrl, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Protection': '1',
  },
  body: JSON.stringify(payload),
});
```

- `Origin`은 브라우저가 보낸다. 서버는 기존 `CORS_ALLOWED_ORIGINS`와 개발용 `CORS_ALLOWED_PORTS`로 검증한다. Origin이 없을 때만 Referer의 origin을 확인한다. 출처 없음·불허·`null` 또는 헤더 누락은 403이다.
- `X-CSRF-Protection: 1`은 비밀 토큰이 아니다. 별도 토큰 발급 API 없이 엄격한 출처 검사와 비단순 요청 헤더로 방어한다. 허용된 FE origin이 preflight를 통과하도록 설정한다.
- multipart도 헤더가 필요하다. `Content-Type`은 직접 지정하지 않고 브라우저가 boundary를 만들게 한다.
- Bearer **access** 토큰을 사용하는 앱 요청은 기존대로 동작한다. refresh는 기존처럼 쿠키가 우선이므로 refresh 쿠키가 함께 전송되면 Bearer가 있어도 CSRF 검사를 받는다.
- OAuth 시작/콜백 GET에는 이 헤더를 넣지 않는다. 시작 경로는 `GET /auth/google`, `/auth/github`, 계정 연결은 각각 `/link`로 유지한다.
- 시작 응답에서 provider별 HttpOnly·host-only·SameSite=Lax 쿠키를 저장한다. Secure 환경의 이름은 `__Host-easy_clip_oauth_google` / `__Host-easy_clip_oauth_github`다. 시작과 콜백은 같은 브라우저·같은 API host의 쿠키 저장소를 사용해야 한다. 앱 외부 브라우저/웹뷰도 이 조건을 유지해야 한다.
- state는 브라우저·provider·만료 시각과 연결되며 DB에서 한 번만 소비한다. 다른 브라우저·provider, 재사용·만료는 400이고 OAuth를 처음부터 다시 시작한다. 같은 provider로 여러 흐름을 시작하면 마지막 시작 쿠키와 연결된 흐름만 완료할 수 있다.
- 계정 연결 콜백은 시작 때와 동일한 사용자 및 access 세션 `sid`가 필요하다. 다른 사용자로 전환하거나 원래 세션 자격 증명이 콜백에 없으면 거부한다.

## 4. 이미지 업로드 오류

기존 `file` 필드 및 JPEG/PNG/WebP/GIF/AVIF를 유지한다. 수신 단계에서 파일 1개, 텍스트 필드 최대 2개(각 1 MiB), 전체 3개 파트와 파일 크기를 제한한다. MIME 헤더와 바이너리 형식이 일치해야 한다. 시그니처 식별이며 완전한 이미지 디코딩/악성 코드 검사는 아니다.

| HTTP                                     | 의미                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| 400                                      | MIME·바이너리 형식 불일치, 지원하지 않는 형식, multipart 개수/필드 초과 |
| 413                                      | 수신 파일 크기 제한 초과                                                |
| 429 + `UPLOAD_RATE_LIMIT_EXCEEDED`       | `Retry-After` 초 이후 재시도 (CORS 응답에서 FE에 노출)                  |
| 503 + `UPLOAD_RATE_LIMIT_NOT_CONFIGURED` | 운영 업로드 제한 설정 필요                                              |
| 503                                      | 요청 제한 관리 용량 초과 등 혼잡                                        |

`CLIP_UPLOAD_REQUESTS_PER_MINUTE`는 운영자가 정할 양의 정수다. 미설정 시 multipart는 503이고 JSON 요청은 영향을 받지 않는다. 사용자별 60초 구간에서 생성·수정 요청을 합산하며 실패한 multipart 요청도 센다. 현재 제한은 프로세스 단위이므로 다중 인스턴스/재시작을 아우르는 공통 상한은 프록시에서 별도 설정해야 한다.

## 5. 마이그레이션·적용 순서

1. FE가 위 헤더·필수 입력·변경 응답을 지원하도록 준비하고 BE와 동시에 전환할 시점을 정한다. 기존 FE의 confirm 입력은 새 BE에서 400이 된다.
2. 운영자가 `PRO_MONTHLY_AMOUNT`, `TOSS_PAYMENTS_CURRENCY=KRW`, `CLIP_UPLOAD_REQUESTS_PER_MINUTE`, 정확한 CORS origin을 설정한다. 기존 자동갱신·취소 운영 정책과 가격 변경 절차는 별도 승인 사항이다.
3. `prisma generate` 및 `prisma migrate deploy`로 OAuth nonce 테이블, 최초 결제 시도 테이블, 후속 취소 의사 보존 컬럼을 추가한 뒤 BE를 배포한다. 기존 사용자·구독·결제 기록의 삭제/금액 변경/백필은 없다. 새 시도 테이블은 비어 시작한다. 과거 최초 결제에서 유실된 주문은 이번 마이그레이션으로 자동 복구되지 않는다.
4. 이전 BE가 동시에 결제 요청을 처리하면 영속 시도 보호를 우회할 수 있다. 배포 전 진행 중 최초 결제를 확인하고 구 BE 결제 트래픽을 배제한 뒤 전환한다. 이미 진행 중이던 OAuth 로그인은 다시 시작해야 한다.
5. nginx 기본 본문 상한은 10 MiB 파일 + 필드/프레이밍을 수용하도록 13 MiB로 맞췄다. `R2_MAX_IMAGE_BYTES`를 바꾸면 nginx/CDN 상한도 맞춘다. nginx access log는 인증 query를 기록하지 않는 형식을 사용한다. 실제 프록시·CDN 로그와 운영 인증 응답은 별도 확인한다.
6. 운영 스케줄러가 보호된 배치 API를 호출하는지 확인한다. 롤백 시 새 테이블/기록은 보존하며 구 BE의 최초 결제를 그대로 재활성화하지 않는다.

검증 결과와 아직 남은 작업은 [08 잔여 BE](08-remaining-be.md)를 참고한다.

## 후속 검색·태그 정책

2026-09-14 사용자 확정에 따른 Pro 전용 검색·태그 계약은 [Free 검색·태그 FE 계약](10-free-search-tags-be-handoff.md)에 정리한다. 이 문서의 P1 검증 결과를 후속 변경의 검증 결과로 재사용하지 않으며, 후속 변경의 검증·배포 상태는 전달 문서에서 별도로 기록한다.
