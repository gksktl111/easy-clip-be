# Free 검색·태그 제한 · BE 완료 보고 및 FE 전달 계약

2026-09-14 사용자 확정 정책. **로컬 구현·회귀 검증 완료. PR [#162](https://github.com/gksktl111/easy-clip-be/pull/162) 반영 대상이며 배포는 미실행이다.** 관련 이슈는 [#161](https://github.com/gksktl111/easy-clip-be/issues/161), 작업 브랜치는 `feat/161`이다. 기존 P1 가격·인증·결제 계약은 [09 문서](09-p1-fe-api-contract.md), 폴더 접근·클립 한도는 [폴더 접근](free-folder-access.md)과 [클립 한도](clip-plan-limits.md)를 함께 따른다.

## 확정 범위

검색과 태그 전용 API는 유효 Pro 전용이다. Free는 접근 가능한 폴더에서도 아래 요청을 거부한다. 일반 클립 생성·조회·수정·삭제, 즐겨찾기, 타입 필터, 복사, 최근 열람 및 기존 폴더 잠금·50/300개 한도는 유지한다. 기존 태그 데이터와 일반 클립 응답의 `tags`도 유지한다. Free 응답을 일괄 `tags: []`로 만들지 않으며 태그 배지의 표시 여부는 FE가 결정한다.

| API | Free | Pro |
| --- | --- | --- |
| `GET /clips?type=ALL&q=검색어` | 정규화 후 비어 있지 않은 `q`는 403 | 기존 제목 검색, 제목 미일치 시 태그 fallback 유지 |
| `GET /clips?folderId=:folderId&type=ALL&q=검색어` | 동일; 폴더 소유권·활성 상태·잠금 먼저 확인 | 해당 폴더 검색 유지 |
| `GET /clips?favorite=true&type=ALL&q=검색어` | 동일 | 즐겨찾기 범위 검색 유지 |
| `GET /clips?recent=true&type=ALL&q=검색어` | 동일 | 최근 클립 범위 검색 유지 |
| `GET /folders/:folderId/tags` | 403 | 기존 조회 유지 |
| `POST /folders/:folderId/tags` | 403 | 기존 생성 유지 |
| `PATCH /folders/:folderId/tags/:tagId` | 403 | 기존 이름·색상 변경 유지 |
| `DELETE /folders/:folderId/tags/:tagId` | 403 | 기존 삭제 유지 |
| `PUT /clips/:clipId/tags` | 빈 배열·기존 이름·새 이름 모두 403 | 기존 전체 교체·자동 생성 유지 |

위 403의 기능 제한 코드는 `FEATURE_NOT_AVAILABLE`다. `type` 등 기존 요청 검증은 유지한다. `folderId`와 `favorite/recent` 혼용, `favorite=true&recent=true`는 기존처럼 400이다.

`GET /clips`의 `q`가 누락되거나 빈 문자열 또는 공백뿐이면 일반 목록으로 처리한다. FE는 검색어를 지운 뒤 검색 조건과 커서를 초기화하고 일반 목록을 조회할 수 있다. `GET /clips/views/recent`는 별도의 최근 열람 목록 API이며 **검색 인자를 추가하지 않는다.** 기본·최근 클립 목록과 최근 열람 목록을 혼동하지 않는다.

## 유효 플랜과 오류

서버가 현재 시각에 `plan=PRO`, `status=ACTIVE` 또는 `CANCELED`, 미래의 `currentPeriodEnd`를 모두 확인한 경우에만 Pro다. 종료 시각에 도달했거나 만료된 경우는 Free다. `autoRenew=true`만으로 Pro를 인정하지 않으며, 해지해도 결제한 잔여 기간은 유지한다.

기존 `GET /subscriptions/me` 응답은 `plan`, `status`, `autoRenew`, `currentPeriodEnd`, `nextBillingAt`, `provider`다. 이번 변경으로 `effectivePlan`, `canUseTags` 같은 필드를 추가하지 않는다. FE는 기존 필드로 안내용 상태를 계산하되, 최신 서버 권한 응답을 최종 기준으로 처리한다.

검색 제한의 실제 오류 형식:

```json
{
  "statusCode": 403,
  "message": "클립 검색은 Pro에서 사용할 수 있습니다.",
  "error": "Forbidden",
  "code": "FEATURE_NOT_AVAILABLE"
}
```

태그 제한의 실제 오류 형식:

```json
{
  "statusCode": 403,
  "message": "태그 관리는 Pro에서 사용할 수 있습니다.",
  "error": "Forbidden",
  "code": "FEATURE_NOT_AVAILABLE"
}
```

사용자 확인에 따라 이 오류에는 **`details`나 새 오류 필드를 추가하지 않는다.** 기존 클립 한도 오류의 `details`는 별도 계약으로 유지한다. FE는 `message` 문자열이 아닌 HTTP 상태·`code`·요청 endpoint로 검색/태그/기존 재정렬 안내를 구분한다. 코드 없는 인증·입력 오류와 알 수 없는 코드는 일반 오류 처리를 유지한다.

정상 형식의 요청은 기존 접근 검사 순서를 유지한다. 폴더·클립의 소유권/존재·활성 상태를 확인한 후 폴더 잠금을 확인한다. 폴더 태그 수정·삭제에서는 접근 가능한 폴더 안의 태그 존재 여부도 기능 제한보다 먼저 확인한다.

1. 대상 폴더·클립 없음·다른 사용자 소유·삭제 상태: 기존 404. 접근 폴더의 없는 태그도 404.
2. 본인 소유지만 잠긴 폴더의 대상: `403 PROJECT_LOCKED`.
3. 접근 가능한 대상에서 Free 검색·태그 요청: `403 FEATURE_NOT_AVAILABLE`.

Free 제한을 먼저 응답해 타인 대상의 존재를 드러내거나 기존 잠금 안내를 덮어쓰지 않는다. 인증·입력 검증 자체의 기존 실패 응답은 그대로다.

## 데이터와 동시성

최종 DB 작업은 기존 구독·폴더·클립 잠금 순서를 유지하고, 잠금을 얻은 뒤 서버의 현재 유효 플랜을 재검사한다. 태그 upsert, 연결 삭제·삽입 등 쓰기 전에 기능 제한을 확인한다. 요청 처리 중 Pro가 만료되거나 잠금 상태가 바뀌어 거부되면 태그 옵션이나 연결이 일부 생성·변경되지 않는다. 읽기와 검색도 최종 조회의 권한 상태를 따른다.

일반 클립 수정은 기존 태그 연결을 보존한다. 태그를 편집하지 않은 일반 저장에서 FE가 `PUT /clips/:clipId/tags`를 자동 호출하지 않도록 분리한다. 특히 Free에서 빈 배열을 보내 태그를 해제하는 동작도 허용하지 않는다. 기존 태그가 반환되더라도 태그 전용 API를 사용할 권한이 있다는 뜻은 아니다.

이번 검색·태그 제한에는 DB 스키마 변경, 마이그레이션, 태그 삭제·백필, 새 환경변수가 없다. 기존 폴더 선정·P1 마이그레이션의 배포 요건은 해당 문서를 따른다.

## FE 반영 및 전환 순서

1. FE는 모든 검색 진입점과 태그 선택·관리·편집 진입점에 Pro 안내를 반영한다. 일반 목록·타입 필터·즐겨찾기·복사 등 기존 사용 흐름은 유지한다. 일반 응답의 태그 배지 표시 방식은 FE에서 결정한다.
2. FE는 `FEATURE_NOT_AVAILABLE`를 endpoint와 함께 처리하고, `PROJECT_LOCKED`와 404를 별도로 처리한다. 구독 갱신은 한 번 묶어서 수행하며 403 자동 재전송 루프를 만들지 않는다.
3. 결제·해지·만료·재로그인 등 권한 변화 시 관련 검색·태그 캐시와 커서를 갱신한다. 진행 중이던 이전 Pro 요청의 늦은 응답이 제한된 화면을 다시 채우지 않도록 취소하거나 무시한다. 기존 저장 데이터는 지우지 않는다.
4. BE는 아래 로컬 검증과 필요한 기존 통합 검증을 완료하고, FE가 오류 처리를 준비했는지 확인한다. FE/BE 전환 순서와 실제 배포 시점은 별도로 합의한다.
5. 승인된 배포 이후 Free 일반 목록·검색 차단·태그 차단·Pro 검색 fallback·기존 데이터 보존·잔여 기간이 있는 해지 구독·만료 전환을 환경에서 확인한다. 배포 결과와 대상 버전은 별도로 기록한다.

판매 가격, 가격 변경 고지·동의, 기존 사용자 적용 조건, 시행일·배포 시점은 이번 확정 범위가 아니다. 이 문서는 커밋·푸시·배포 실행을 승인하지 않는다.

## 검증 결과

2026-09-14, 격리 PostgreSQL 16 `test_db`와 로컬 Nest HTTP 앱에서 확인했다. 실제 JWT 쿠키, 허용 Origin 및 CSRF 헤더를 사용해 유료 기능 제한을 다른 인증 403과 구분했다. DB 스냅샷으로 거부 전후 Tag/ClipTag의 동일성을 검사했다.

| 실행 | 결과 |
| --- | --- |
| `pnpm test --runInBand` | 56 suites, 308 tests 통과 |
| `pnpm test:e2e --runInBand` | 최종 변경 상태 전체 10 suites, 123 tests 통과; 검색·태그 보강 사례 14개 포함 |
| `pnpm install --frozen-lockfile` | 통과 |
| `pnpm prisma generate`, `pnpm prisma migrate deploy` | 통과; 별도 PostgreSQL 16 `test_db`에 전체 32개 마이그레이션 적용 |
| `pnpm lint`, `pnpm build` | 통과 |

푸시 전 최종 변경 상태로 전체 단위·E2E 검증을 실행했다. 확인된 동작은 다음과 같다.

- Free의 기본/폴더/즐겨찾기/최근 검색 차단과 공백 일반 목록, Pro 제목 검색·태그 fallback.
- 검색 존재 확인·커서 조회 이전 차단. 실제 Pro 검색 커서를 다운그레이드 후 `q`와 재사용해도 거부. `q`를 제거한 일반 페이지 조회는 허용.
- 태그 5개 API 차단. 새 이름·기존 이름·빈 배열·변경 없는 PATCH를 포함해 태그 데이터 보존.
- 없는/삭제/타인 자원의 기존 404, 잠긴 폴더의 `PROJECT_LOCKED`, 접근 폴더의 `FEATURE_NOT_AVAILABLE`.
- ACTIVE Pro와 해지 예약 잔여 기간의 사용 허용, 만료 후 차단, 재구독 후 기존 태그 재사용.
- PostgreSQL의 실제 구독 잠금 대기를 확인한 뒤 플랜/기간을 변경: 태그 생성·수정·삭제·클립 태그 교체 모두 거부하고 부분 쓰기 없음.
- 폴더 잠금을 기다리는 사이 실제 종료 시각이 지난 클립 태그 교체도 거부.
- 기존 일반 클립 수정·삭제·폴더 접근·한도 등의 회귀 테스트 유지.

FE 코드 및 FE mock E2E 수정, 실제 FE와의 연동, 운영 서버/컨테이너 버전 확인, 배포 후 인수는 미실행이다. 기존 사용자 적용 범위·고지 시점·태그 배지 표시·배포 일정은 담당자 결정이 필요하다. 이 보고서를 FE 구현·검수 입력으로 사용하고, 실제 배포 결과는 별도로 기록한다.
