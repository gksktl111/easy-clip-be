# Lightsail 운영 배포 메모

이 문서는 Lightsail 단일 인스턴스에서 API, PostgreSQL, Nginx, Grafana Alloy를 Docker Compose로 실행하고, 메트릭과 로그는 Grafana Cloud에서 확인하기 위한 최소 절차를 정리한다.

## 구성

- `api`: NestJS 애플리케이션 컨테이너
- `postgres`: PostgreSQL 컨테이너
- `nginx`: HTTP 리버스 프록시
- `postgres-exporter`: PostgreSQL 연결·서버 상태 메트릭을 내부 네트워크에서 제공하는 exporter
- `alloy`: API와 PostgreSQL exporter의 `/metrics`를 15초마다 수집해 Grafana Cloud Metrics로 전송하고, API Pino stdout 로그를 Grafana Cloud Loki로 전송하는 collector
- `postgres-data`: PostgreSQL 데이터 볼륨
- `alloy-data`: 전송 재시도용 Alloy 상태 볼륨

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
GRAFANA_CLOUD_PROMETHEUS_URL
GRAFANA_CLOUD_PROMETHEUS_USERNAME
GRAFANA_CLOUD_METRICS_WRITE_TOKEN
GRAFANA_CLOUD_LOKI_URL
GRAFANA_CLOUD_LOKI_USERNAME
GRAFANA_CLOUD_LOGS_WRITE_TOKEN
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

`api`, `postgres`, `postgres-exporter`, `nginx`, `alloy`가 모두 `Up`인지 확인한다. API의 `/metrics`는 외부 Nginx에서 차단되며, Alloy만 Docker 내부 네트워크에서 `api:3000/metrics`, `postgres-exporter:9187/metrics`를 수집한다.

Alloy 로그에서 Grafana Cloud 전송 오류가 없는지 확인한다.

```bash
docker compose --env-file .env.production -f docker/docker-compose.production.yml logs -f alloy
```

Grafana Cloud Stack URL로 접속한 뒤 [Grafana Cloud 대시보드](../grafana-cloud/easy-clip-api-observability.json)를 Import하고 Prometheus·Loki 데이터 소스를 각각 선택한다. 대시보드는 HTTP 상태 비율, 엔드포인트별 p95·5xx 비율, PostgreSQL 연결, Prisma DB 쿼리 p95/p99·느린 작업과 축약 HTTP 요청 로그, 경고·오류 로그, 원본 Pino JSON 상세 조사 패널을 제공한다. 원문 SQL·파라미터는 라벨로 전송하지 않는다. 운영 Pino HTTP 로그를 전송하려면 `.env.production`의 `ENABLE_HTTP_LOGGING=true`를 유지한다.

실제 알림은 Grafana Cloud Alerting에서 Prometheus 메트릭(예: 5xx 오류율, p95 응답 시간)을 기준으로 만든다. 임계치와 Slack·이메일 등의 수신 채널은 운영 정책에 따라 결정한 뒤 설정한다.

Alloy는 Docker API를 통해 API 컨테이너 로그를 읽으므로 `/var/run/docker.sock`을 마운트한다. Docker socket 접근 권한은 강하므로, 운영 서버 접근 권한과 Compose 파일 수정 권한을 제한한다.

## DNS

Cloudflare DNS에서 `API_DOMAIN`에 해당하는 A 레코드를 Lightsail 고정 IP로 연결한다.

Nginx가 80 포트로 API 컨테이너에 프록시하므로 Lightsail 방화벽과 OS 방화벽에서 `80` 포트를 허용해야 한다.

HTTPS는 별도 단계에서 Cloudflare 프록시와 Origin Certificate 또는 certbot 방식 중 하나로 구성한다.
