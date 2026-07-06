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

## Tech Stack

- NestJS
- Prisma
- PostgreSQL
- Passport
- JWT
- Swagger
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
AUTO_RENEWALS_BATCH_ENABLED=false
AUTO_RENEWALS_BATCH_SECRET=

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=...
```

OAuth 로그인 성공 후 백엔드는 access/refresh token을 `httpOnly` 쿠키로 저장한 뒤 프론트엔드의 `/{userId}/favorites` 경로로 리다이렉트합니다.

- `OAUTH_STATE_SECRET`: OAuth state 변조 방지를 위한 HMAC secret. 미설정 시 `JWT_ACCESS_SECRET`을 사용합니다.
- `OAUTH_SUCCESS_REDIRECT_BASE_URL`: 로그인 완료 후 조합할 프론트 base URL. 최종 이동 주소는 `<base-url>/<userId>/favorites` 형태입니다.
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

운영 배포는 EC2 + PM2 + GitHub Actions 기반으로 구성합니다.

### EC2 Runtime

- 서버 경로: `/home/ec2-user/easy-clip-be`
- 프로세스 매니저: `pm2`
- 실행 엔트리: `pnpm start:prod`

PM2 예시:

```bash
export NODE_ENV=production
pm2 start dist/src/main.js --name easy-clip-be --interpreter node --update-env
pm2 save
```

### Deploy Script

서버 배포 스크립트:

- `deploy.sh`

동작 순서:

1. `git pull origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm prisma generate`
4. `pnpm prisma migrate deploy`
5. `pnpm build`
6. `pm2 restart easy-clip-be --update-env`
7. `pm2 save`

### GitHub Actions

- PR 검증: `.github/workflows/ci.yml`
- 운영 배포: `.github/workflows/deploy.yml`

배포 워크플로우는 `main` 브랜치 push 시 동작하며, `appleboy/ssh-action`을 통해 EC2에서 `deploy.sh`를 실행합니다.

필요한 GitHub Secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

## Operational Notes

- Prisma 관련 명령과 운영 실행은 `NODE_ENV=production` 기준으로 수행합니다.
- RDS 접속 오류가 발생하면 먼저 `DATABASE_URL`, 사용자명, 비밀번호, DB 이름, `sslmode=require` 여부를 확인합니다.
- 앱 실행 실패 시 우선 확인 순서:
  - `pnpm build`
  - `pnpm start:prod`
  - `pm2 logs easy-clip-be`

## Repository Conventions

- 기본 개발 브랜치: `dev`
- 운영 반영 브랜치: `main`
- PR 검증은 `dev`, `main` 대상 PR 기준으로 동작
- 배포는 `main` push 기준으로 동작

## License

UNLICENSED
