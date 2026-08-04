# Lightsail 운영 배포 메모

이 문서는 Lightsail 단일 인스턴스에서 API, PostgreSQL, Nginx를 Docker Compose로 실행하기 위한 최소 절차를 정리한다.

## 구성

- `api`: NestJS 애플리케이션 컨테이너
- `postgres`: PostgreSQL 컨테이너
- `nginx`: HTTP 리버스 프록시
- `postgres-data`: PostgreSQL 데이터 볼륨

## 최초 설정

운영 서버에서 `.env.production.example`을 기준으로 `.env.production`을 만든다.

```bash
cp .env.production.example .env.production
```

최소한 다음 값은 실제 운영 값으로 교체한다.

```text
POSTGRES_PASSWORD
DATABASE_URL
API_DOMAIN
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
OAUTH_STATE_SECRET
CORS_ALLOWED_ORIGINS
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI
```

`DATABASE_URL`은 compose 내부의 `postgres` 서비스를 바라봐야 한다.

```text
postgresql://easy_clip:<POSTGRES_PASSWORD>@postgres:5432/easy_clip?schema=public
```

## 실행

설정 파일을 먼저 검증한다.

```bash
docker compose --env-file .env.production -f docker/docker-compose.production.yml config
```

이미지를 빌드하고 서비스를 실행한다.

```bash
docker compose --env-file .env.production -f docker/docker-compose.production.yml up -d --build
```

로그 확인:

```bash
docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f api
```

상태 확인:

```bash
docker compose --env-file .env.production -f docker/docker-compose.production.yml ps
```

## DNS

Cloudflare DNS에서 `API_DOMAIN`에 해당하는 A 레코드를 Lightsail 고정 IP로 연결한다.

Nginx가 80 포트로 API 컨테이너에 프록시하므로 Lightsail 방화벽과 OS 방화벽에서 `80` 포트를 허용해야 한다.

HTTPS는 별도 단계에서 Cloudflare 프록시와 Origin Certificate 또는 certbot 방식 중 하나로 구성한다.
