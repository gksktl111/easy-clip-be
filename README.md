# Easy Clip Backend

Easy Clip 백엔드 API 서버입니다.  
NestJS와 Prisma를 기반으로 개인 워크스페이스 중심의 클립 저장, 폴더 관리, 소셜 로그인, 사용자 설정, 구독 정보, 휴지통 기능을 제공합니다.

## Overview

- Framework: NestJS 11
- Language: TypeScript
- Database: PostgreSQL + Prisma
- Auth: Google OAuth, GitHub OAuth, JWT Access/Refresh Token
- Runtime: Node.js 22
- Process Manager: PM2
- Deployment: GitHub Actions -> EC2 SSH 배포

## Main Features

- 인증
  - Google / GitHub OAuth 로그인
  - 계정 연결 및 사용자 전환
  - Access Token / Refresh Token 재발급
  - 로그아웃
- 클립
  - TEXT / COLOR / IMAGE 타입 클립 생성
  - 클립 수정, 삭제
  - 폴더별 / 좋아요 / 최근 클립 목록 조회
  - 클립 조회 기록, 좋아요 등록 / 취소
- 폴더
  - 폴더 생성, 수정, 삭제
  - 폴더 순서 변경
  - 폴더별 태그 관리
- 사용자 / 워크스페이스
  - 내 프로필 조회 / 수정 / 탈퇴
  - 사용자 설정 조회 / 수정
  - 개인 워크스페이스 구독 정보 조회 / 수정
- 휴지통
  - 삭제된 클립 / 폴더 조회
  - 복구 및 영구 삭제

## Architecture

프로젝트는 기능 도메인 중심의 클린 아키텍처 구조를 따릅니다.

```text
src/
  auth/
  clips/
  folders/
  users/
  workspaces/
  trash/
  prisma/
  shared/
```

각 기능 도메인은 기본적으로 아래 레이어를 가집니다.

- `presentation`
  - controller, dto, guard, strategy
- `application`
  - usecase, input/output dto, helper, error
- `domain`
  - entity, repository interface, domain type
- `infrastructure`
  - Prisma 기반 repository 구현

공통 인증 계약, 가드, 예외 응답 등은 `src/shared`에 둡니다.

## API Modules

- `AuthController` -> `/auth`
- `UsersController` -> `/users`
- `FoldersController` -> `/folders`
- `ClipsController` -> `/clips`
- `WorkspacesController` -> `/workspaces`
- `TrashController` -> `/trash`

Swagger 문서는 local 환경에서 앱 실행 후 `/docs`에서 확인할 수 있습니다. production 환경에서는 기본적으로 비활성화되며, 운영에서 필요할 때만 `ENABLE_SWAGGER=true`로 명시적으로 활성화합니다.

## Monitoring

애플리케이션은 Prometheus 형식의 `/metrics` 엔드포인트를 제공합니다. HTTP 메트릭에는 `method`, 템플릿 기반 `route`, `status_code`만 라벨로 사용하므로 사용자 ID, 요청 ID, 원본 URL query와 같은 고카디널리티·민감 값은 수집하지 않습니다.

- `easy_clip_http_requests_total`: HTTP 요청 수
- `easy_clip_http_request_duration_seconds`: HTTP 요청 처리 시간 Histogram
- `easy_clip_http_requests_in_progress`: 처리 중 HTTP 요청 수
- `easy_clip_db_queries_total`: Prisma를 통해 완료된 DB 쿼리 수
- `easy_clip_db_query_duration_seconds`: Prisma DB 쿼리 왕복 시간 Histogram
- `easy_clip_nodejs_*`, `easy_clip_process_*`: Node.js 프로세스 기본 메트릭

PostgreSQL 자체의 연결 수·최대 연결 수 등은 애플리케이션 메트릭이 아니라 `postgres_exporter`가 수집합니다. DB 원본 SQL이나 파라미터는 Prometheus 라벨로 내보내지 않고, `select Clip`처럼 정규화한 작업·모델만 집계합니다.

### Local

앱·PostgreSQL exporter·Prometheus·Loki·Alloy·Grafana를 하나의 Docker Compose 스택으로 실행합니다. Grafana 관리자 비밀번호는 `.env.local`의 실제 강력한 값으로 먼저 바꿉니다. `replace_with_strong_grafana_password`는 사용할 수 있는 비밀번호가 아닌 예시 문자열입니다.

```bash
docker compose --env-file .env.local -f docker/docker-compose.yml up -d --build
```

`docker/` 디렉터리에서 실행한다면 경로는 아래와 같습니다.

```bash
docker compose --env-file ../.env.local -f docker-compose.yml up -d --build
```

요청을 한 번 발생시킨 뒤 아래 주소에서 확인합니다.

- 애플리케이션 메트릭: `http://localhost:3000/metrics`
- Prometheus Targets: `http://localhost:9090/targets` (`easy-clip-api`, `easy-clip-postgres`가 `UP`이어야 함)
- Grafana: `http://localhost:3300` (`.env.local`의 `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`)
- Alloy 상태/UI: `http://localhost:12345`

이미 호스트의 `3000` 포트를 사용 중이면 `LOCAL_API_PORT=3002 docker compose --env-file .env.local -f docker/docker-compose.yml up -d --build`처럼 API 포트만 변경합니다. 이 경우 애플리케이션 메트릭 주소는 `http://localhost:3002/metrics`입니다.

Grafana 데이터 소스와 `Easy Clip API 운영 현황` 대시보드는 자동으로 provision됩니다. 로그는 아래 세 패널로 봅니다.

- `HTTP 요청 로그`: 원본 JSON을 화면에서만 `INFO GET /clips → 200 14ms` 형식으로 축약
- `경고 · 오류 로그`: Pino warn/error/fatal 로그만 빠르게 확인
- `원본 Pino JSON · 상세 조사`: 요청 ID, 예외, 정제된 요청·응답 속성 확인

메트릭 패널에는 아래 진단 화면도 포함됩니다.

- `HTTP 상태 비율`과 `주요 4xx 비율`: 2xx/4xx/5xx 및 401/403/404/429 변화 확인
- `Top 5 느린 엔드포인트 (p95)`, `Top 5 오류 엔드포인트 (5xx 비율)`: 전체 평균에 묻히는 엔드포인트 문제 확인
- `PostgreSQL 연결`: DB 서버의 현재 연결 수·최대 연결 수·사용률 확인
- `DB 쿼리 지연 시간`, `Top 5 느린 DB 작업 (p95)`: Prisma DB 왕복 시간과 정규화된 작업 단위의 지연 확인

`PostgreSQL 연결`은 Prisma 내부 pool 객체의 사용량이 아니라 DB 서버에서 관측한 전체 세션 사용량입니다. 원문 SQL 단위의 Slow Query 분석은 `pg_stat_statements` 확장과 별도 권한·재시작 정책이 필요하므로, 현재는 민감정보와 고카디널리티를 피한 작업·모델 단위만 제공합니다.

원본 JSON은 Loki에 그대로 보존됩니다. 요청 ID로 상세 조사가 필요하면 Grafana Explore의 Loki 데이터 소스에서 아래처럼 검색합니다.

```logql
{service="easy-clip-api", environment="local"} | json | req_id="<요청_ID>"
```

`req_id`, 사용자 ID, 원본 URL query는 검색용 필드로만 두고 Loki 라벨로 만들지 않습니다. 기존 Grafana 볼륨이 이미 있다면 환경 변수 변경만으로 관리자 비밀번호는 바뀌지 않으므로 Grafana UI에서 변경합니다.

Alloy는 API 컨테이너 로그만 수집합니다. Docker 로그를 읽기 위해 Docker socket을 마운트하므로, 신뢰할 수 있는 서버의 Compose 스택에서만 실행합니다.

로컬 Compose의 API는 관측성 확인 중 스키마를 변경하지 않도록 migration을 자동 실행하지 않습니다. 새 스키마가 필요할 때는 검토 후 별도로 `pnpm prisma migrate deploy`를 실행합니다.

### Production

운영 Compose는 Alloy가 Docker 내부 네트워크의 `api:3000/metrics`와 `postgres-exporter:9187/metrics`를 15초마다 수집해 Grafana Cloud Metrics로 전송하고, API 컨테이너의 Pino stdout 로그를 Grafana Cloud Loki로 전송하도록 구성합니다. `/metrics`는 Nginx에서 계속 `404`로 차단되며, 운영 서버에 Prometheus·Loki·Grafana 포트는 열리지 않습니다.

`.env.production`에는 다음 값을 반드시 설정합니다.

```env
ENABLE_HTTP_LOGGING=true
GRAFANA_CLOUD_PROMETHEUS_URL=<Grafana_Cloud_Metrics_remote_write_전체_URL>
GRAFANA_CLOUD_PROMETHEUS_USERNAME=<Metrics_instance_ID>
GRAFANA_CLOUD_METRICS_WRITE_TOKEN=<metrics:write_토큰>
GRAFANA_CLOUD_LOKI_URL=<Grafana_Cloud_Loki_push_전체_URL>
GRAFANA_CLOUD_LOKI_USERNAME=<Loki_instance_ID>
GRAFANA_CLOUD_LOGS_WRITE_TOKEN=<logs:write_토큰>
```

값은 Grafana Cloud의 Connections에서 Hosted Prometheus Metrics와 Hosted Logs를 추가할 때 제공됩니다. 토큰은 해당 Stack 범위의 Cloud access policy로 각각 `metrics:write`, `logs:write` 권한만 부여해 발급합니다. 실제 토큰은 채팅·저장소·커밋에 넣지 않고 운영 서버의 `.env.production`에만 저장합니다.

운영 데이터는 Grafana Cloud Stack URL로 접속해 확인합니다. 저장소의 [Grafana Cloud 대시보드](grafana-cloud/easy-clip-api-observability.json)를 Import하고 Prometheus·Loki 데이터 소스를 각각 선택하면 HTTP 상태 비율, 엔드포인트별 지연·오류율, PostgreSQL 연결, DB 쿼리 p95/p99와 함께 축약 요청 로그·경고/오류 로그·원본 Pino JSON을 한 화면에서 확인할 수 있습니다.

알림은 로그가 아닌 Prometheus 메트릭을 기준으로 Grafana Cloud Alerting에서 구성합니다. 실제 임계치와 Slack·이메일 등의 수신 채널은 서비스 기준과 운영 권한에 따라 달라지므로, 이 저장소에서는 자동 생성하지 않습니다.

운영 서버는 Grafana Cloud endpoint로의 아웃바운드 HTTPS 연결이 가능해야 합니다. Alloy 전송 상태는 `docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f alloy`로 확인합니다.

## Tech Stack

- NestJS
- Prisma
- PostgreSQL
- Passport
- JWT
- Swagger
- Pino
- Prometheus
- Grafana / Loki / Alloy
- Jest
- ESLint / Prettier
- PM2
- GitHub Actions

## Requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL

## Environment Variables

앱은 실행 환경에 따라 다른 env 파일을 읽습니다.

- local: `.env.local`
- production: `.env.production`

예시 파일:

- `.env.production.example`

주요 환경 변수:

```env
NODE_ENV=local
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
OAUTH_STATE_SECRET=...
OAUTH_SUCCESS_REDIRECT_BASE_URL=http://localhost:3001
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false
AUTH_ACCESS_TOKEN_COOKIE_NAME=easy_clip_access_token
AUTH_REFRESH_TOKEN_COOKIE_NAME=easy_clip_refresh_token
TEST_ADMIN_LOGIN_ENABLED=false
TEST_ADMIN_LOGIN_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=https://cdn.example.com
R2_ENDPOINT=
R2_IMAGE_PREFIX=clips
R2_MAX_IMAGE_BYTES=10485760
CORS_ALLOWED_ORIGINS=http://localhost:3001
CORS_ALLOWED_PORTS=3000,3001,5173
ENABLE_SWAGGER=true
ENABLE_HTTP_LOGGING=true
AUTO_RENEWALS_BATCH_ENABLED=false
AUTO_RENEWALS_BATCH_SECRET=

# local Grafana 전용
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=...

# production Grafana Cloud 전용
GRAFANA_CLOUD_PROMETHEUS_URL=...
GRAFANA_CLOUD_PROMETHEUS_USERNAME=...
GRAFANA_CLOUD_METRICS_WRITE_TOKEN=...
GRAFANA_CLOUD_LOKI_URL=...
GRAFANA_CLOUD_LOKI_USERNAME=...
GRAFANA_CLOUD_LOGS_WRITE_TOKEN=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=...
```

OAuth 로그인 성공 후 백엔드는 access/refresh token을 `httpOnly` 쿠키로 저장한 뒤 프론트엔드의 `/favorites` 경로로 리다이렉트합니다.

- `OAUTH_STATE_SECRET`: OAuth state 변조 방지를 위한 HMAC secret. 미설정 시 `JWT_ACCESS_SECRET`을 사용합니다.
- `OAUTH_SUCCESS_REDIRECT_BASE_URL`: 로그인 완료 후 조합할 프론트 base URL. 최종 이동 주소는 `<base-url>/favorites` 형태입니다.
- `AUTH_COOKIE_DOMAIN`: 운영에서 쿠키를 공유할 도메인이 필요할 때만 설정
- `AUTH_COOKIE_SECURE`: `true`면 `Secure` 쿠키로 발급, 미설정 시 `NODE_ENV=production`에서 자동 활성화
- `AUTH_ACCESS_TOKEN_COOKIE_NAME`, `AUTH_REFRESH_TOKEN_COOKIE_NAME`: 쿠키 이름 커스터마이징
- `TEST_ADMIN_LOGIN_ENABLED`: local/test에서 테스트 관리자 로그인을 명시적으로 켤 때만 `true`로 설정. production에서는 항상 차단됩니다.
- `TEST_ADMIN_LOGIN_SECRET`: 테스트 관리자 로그인 호출 시 `x-test-admin-secret` 헤더로 전달해야 하는 시크릿
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 업로드 자격 증명
- `R2_PUBLIC_BASE_URL`: 업로드된 이미지에 프론트가 직접 접근할 공개 base URL. 객체 경로까지 넣지 말고 도메인 루트만 넣습니다. 예: `https://cdn.example.com`
- `R2_ENDPOINT`: 미설정 시 `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` 사용
- `R2_IMAGE_PREFIX`: 객체 key prefix, 기본값은 `clips`
- `R2_MAX_IMAGE_BYTES`: 업로드 허용 최대 크기, 기본값은 `10485760`(10MB)
- `CORS_ALLOWED_ORIGINS`: API 호출을 허용할 전체 origin 목록. 운영에서는 배포된 프론트 도메인을 쉼표로 구분해 명시합니다. 예: `https://app.easy-clip.app,https://www.easy-clip.app`
- `CORS_ALLOWED_PORTS`: local 개발에서만 허용할 `localhost`/`127.0.0.1` 포트 목록
- `ENABLE_SWAGGER`: production에서는 기본 비활성화됩니다. 운영에서 문서 노출이 필요할 때만 `true`로 설정합니다.
- `ENABLE_HTTP_LOGGING`: Pino HTTP 요청 로그를 제어합니다. local에서는 기본 활성화입니다. Grafana Cloud Loki로 운영 요청 로그를 수집하려면 production에서도 `true`로 설정합니다.
- `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`: local Docker Grafana 관리자 계정입니다. 로컬 Compose 실행 시 `--env-file .env.local`로 전달합니다.
- `GRAFANA_CLOUD_PROMETHEUS_URL`, `GRAFANA_CLOUD_PROMETHEUS_USERNAME`: Grafana Cloud Metrics remote-write endpoint와 instance ID입니다.
- `GRAFANA_CLOUD_METRICS_WRITE_TOKEN`: `metrics:write` 전용 Cloud access policy token입니다.
- `GRAFANA_CLOUD_LOKI_URL`, `GRAFANA_CLOUD_LOKI_USERNAME`: Grafana Cloud Loki push endpoint와 instance ID입니다.
- `GRAFANA_CLOUD_LOGS_WRITE_TOKEN`: `logs:write` 전용 Cloud access policy token입니다.
- `AUTO_RENEWALS_BATCH_ENABLED`: 자동결제 배치 엔드포인트를 명시적으로 켤 때만 `true`로 설정
- `AUTO_RENEWALS_BATCH_SECRET`: 자동결제 배치 엔드포인트 호출 시 `x-auto-renewals-secret` 헤더로 전달해야 하는 시크릿

운영 환경에서 PostgreSQL(RDS)을 사용할 때는 필요에 따라 `sslmode=require`를 포함합니다.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require
```

## Getting Started

의존성 설치:

```bash
pnpm install
```

Prisma Client 생성:

```bash
pnpm prisma generate
```

마이그레이션 적용:

```bash
pnpm prisma migrate deploy
```

개발 서버 실행:

```bash
pnpm start:dev
```

프로덕션 빌드:

```bash
pnpm build
```

프로덕션 실행:

```bash
pnpm start:prod
```

## Scripts

```bash
pnpm start
pnpm start:dev
pnpm start:debug
pnpm start:prod

pnpm build
pnpm lint
pnpm format

pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:e2e
```

## Database

스키마 파일:

- `prisma/schema.prisma`

마이그레이션 경로:

- `prisma/migrations`

현재 주요 모델:

- `User`
- `AuthAccount`
- `RefreshToken`
- `Workspace`
- `UserSettings`
- `Subscription`
- `Folder`
- `Clip`
- `Tag`
- `ClipTag`
- `ClipLike`
- `ClipView`

## Testing

단위 테스트:

```bash
pnpm test
```

e2e 테스트:

```bash
pnpm test:e2e
```

CI에서는 PostgreSQL 서비스 컨테이너를 띄운 뒤 아래 순서로 검증합니다.

- `pnpm install --frozen-lockfile`
- `pnpm prisma generate`
- `pnpm prisma migrate deploy`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

## Deployment

운영 배포는 Lightsail 단일 인스턴스 + Docker Compose + GitHub Actions 기반으로 구성합니다.

### Lightsail Runtime

- 서버 경로 기본값: `/home/ubuntu/easy-clip-be`
- 실행 구성: `docker/docker-compose.production.yml`
- 서비스: `api`, `postgres`, `nginx`, `prometheus`, `grafana`
- 운영 환경 파일: `.env.production`

### Deploy Script

서버 배포 스크립트:

- `deploy.sh`

동작 순서:

1. `git fetch origin main`
2. `git reset --hard origin/main`
3. `docker compose --env-file .env.production -f docker/docker-compose.production.yml up -d --build --remove-orphans`
4. `docker image prune -f`

### GitHub Actions

- PR 검증: `.github/workflows/ci.yml`
- 운영 배포: `.github/workflows/deploy.yml`

배포 워크플로우는 `main` 브랜치 push 시 동작하며, `appleboy/ssh-action`을 통해 Lightsail 인스턴스에서 `deploy.sh`를 실행합니다.

필요한 GitHub Secrets:

- `LIGHTSAIL_HOST`
- `LIGHTSAIL_USER`
- `LIGHTSAIL_SSH_KEY`
- `LIGHTSAIL_APP_DIR` (선택, 기본값: `/home/ubuntu/easy-clip-be`)

## Operational Notes

- Prisma migration은 API 컨테이너 시작 시 `prisma migrate deploy`로 수행합니다.
- DB 접속 오류가 발생하면 먼저 `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`를 확인합니다.
- 앱 실행 실패 시 우선 확인 순서:
  - `docker compose --env-file .env.production -f docker/docker-compose.production.yml ps`
  - `docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f api`
  - `docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f nginx`
  - `docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f prometheus`
  - `docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f grafana`

## Repository Conventions

- 기본 개발 브랜치: `dev`
- 운영 반영 브랜치: `main`
- PR 검증은 `dev`, `main` 대상 PR 기준으로 동작
- 배포는 `main` push 기준으로 동작

## License

UNLICENSED
