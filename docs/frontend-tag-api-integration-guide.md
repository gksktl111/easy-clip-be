# 프론트엔드 태그 API 연동 가이드

폴더 태그는 폴더별로 관리하며, 클립에는 해당 클립이 속한 폴더의 태그만 연결할 수 있습니다. 이 문서는 태그 선택 UI, 태그 관리 UI, 클립 편집 UI에서 어떤 API를 사용해야 하는지 정리합니다.

## 공통 규칙

- 모든 요청에는 액세스 토큰이 필요합니다.

  ```http
  Authorization: Bearer <access-token>
  ```

- 태그 이름은 공백을 포함해 최대 10자이며, 공백만으로 된 이름은 사용할 수 없습니다.
- 서버는 태그 이름의 대소문자와 앞뒤 공백을 그대로 구분합니다. 프론트엔드에서 `trim`, 소문자 변환, 공백 축약을 적용하지 않습니다.
- 태그 색상은 아래 값 중 하나입니다. 색상을 보내지 않고 태그를 만들면 기본값은 `GRAY`입니다.

  | 값 | 권장 표시 색상 |
  | --- | --- |
  | `GRAY` | 회색 |
  | `BROWN` | 갈색 |
  | `ORANGE` | 주황색 |
  | `YELLOW` | 노란색 |
  | `GREEN` | 초록색 |
  | `BLUE` | 파란색 |
  | `PURPLE` | 보라색 |
  | `PINK` | 분홍색 |
  | `RED` | 빨간색 |

```ts
type TagBackgroundColor =
  | 'GRAY'
  | 'BROWN'
  | 'ORANGE'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'PURPLE'
  | 'PINK'
  | 'RED';

type FolderTag = {
  id: string;
  name: string;
  backgroundColor: TagBackgroundColor;
  folderId: string;
};

type ClipTag = Omit<FolderTag, 'folderId'>;
```

## 상황별 API 선택

| 상황 | 사용할 API | 프론트엔드 처리 |
| --- | --- | --- |
| 폴더 화면 또는 태그 선택기를 처음 열 때 | `GET /folders/:folderId/tags` | 해당 폴더의 태그 목록을 불러옵니다. |
| 태그 관리 화면에서 새 태그와 색상을 만들 때 | `POST /folders/:folderId/tags` | 이름과 선택한 색상을 함께 보냅니다. |
| 태그 이름 또는 배경색을 바꿀 때 | `PATCH /folders/:folderId/tags/:tagId` | 바뀐 필드만 보냅니다. 이름과 색상은 한 번에 변경할 수 있습니다. |
| 태그 자체를 완전히 없앨 때 | `DELETE /folders/:folderId/tags/:tagId` | 이 태그가 연결된 클립에서도 태그 연결이 사라진다는 안내를 보여 줍니다. |
| 클립에서 선택한 태그 조합을 저장할 때 | `PUT /clips/:clipId/tags` | 선택된 **태그 이름 전체**를 보냅니다. 태그 ID를 보내지 않습니다. |
| 클립 편집 중 새 이름을 즉시 추가할 때 | `PUT /clips/:clipId/tags` | 이름이 현재 폴더에 없으면 서버가 회색 태그를 자동 생성합니다. |
| 새 태그에 색상을 지정한 뒤 클립에 추가할 때 | `POST /folders/:folderId/tags` 후 `PUT /clips/:clipId/tags` | 먼저 색상을 포함해 태그를 생성하고, 응답의 `name`을 클립 태그 저장 요청에 넣습니다. |
| 클립에 이미 연결된 태그를 표시할 때 | 클립 목록·최근 본 목록 응답의 `tags` 사용 | 별도의 태그 조회 없이 각 클립 항목에 포함된 `tags`를 렌더링합니다. |

클립 태그 저장 API는 부분 추가/삭제 API가 아니라 **교체 API**입니다. 저장 시점에 UI에서 선택된 태그 이름 전체를 보내야 합니다. 태그를 모두 해제하려면 `tags: []`를 보냅니다.

## 폴더 태그 조회

태그 선택기나 폴더 태그 관리 화면을 열 때 사용합니다.

```http
GET /folders/{folderId}/tags
```

성공 시 `200 OK`:

```json
[
  {
    "id": "5f38f251-477a-4a4f-a31e-3ee682d45b93",
    "name": "중요",
    "backgroundColor": "RED",
    "folderId": "a4d3e47c-df5d-487e-9afb-c4c88699a093"
  },
  {
    "id": "f97fc47c-8b46-4501-b7a6-258bbfc17251",
    "name": "나중에 보기",
    "backgroundColor": "BLUE",
    "folderId": "a4d3e47c-df5d-487e-9afb-c4c88699a093"
  }
]
```

폴더가 없거나 현재 사용자가 접근할 수 없으면 `404 Not Found`가 반환됩니다.

## 폴더 태그 생성

태그 관리 화면에서 색상까지 정해서 새 태그를 만들 때 사용합니다.

```http
POST /folders/{folderId}/tags
Content-Type: application/json

{
  "name": "중요",
  "backgroundColor": "RED"
}
```

성공 시 `201 Created`:

```json
{
  "id": "5f38f251-477a-4a4f-a31e-3ee682d45b93",
  "name": "중요",
  "backgroundColor": "RED",
  "folderId": "a4d3e47c-df5d-487e-9afb-c4c88699a093"
}
```

색상을 생략하면 회색 태그가 생성됩니다.

```json
{
  "name": "읽을거리"
}
```

```json
{
  "id": "65f0073b-0b7d-405c-b7d9-d0920ba54aac",
  "name": "읽을거리",
  "backgroundColor": "GRAY",
  "folderId": "a4d3e47c-df5d-487e-9afb-c4c88699a093"
}
```

같은 폴더에 정확히 같은 이름의 태그가 이미 있으면 `409 Conflict`가 반환됩니다.

## 폴더 태그 수정

태그 이름이나 색상만 수정할 때 사용합니다. 수정하려는 필드를 하나 이상 보내야 합니다.

```http
PATCH /folders/{folderId}/tags/{tagId}
Content-Type: application/json

{
  "backgroundColor": "ORANGE"
}
```

성공 시 `200 OK`:

```json
{
  "id": "5f38f251-477a-4a4f-a31e-3ee682d45b93",
  "name": "중요",
  "backgroundColor": "ORANGE",
  "folderId": "a4d3e47c-df5d-487e-9afb-c4c88699a093"
}
```

이름과 색상은 함께 바꿀 수 있습니다.

```json
{
  "name": "업무",
  "backgroundColor": "BROWN"
}
```

`{}`처럼 변경할 필드가 없는 요청, 10자를 넘는 이름, 공백만 있는 이름, 허용되지 않은 색상은 `400 Bad Request`입니다. 다른 태그와 이름이 같아지는 경우에는 `409 Conflict`입니다.

## 폴더 태그 삭제

태그 관리 화면에서 태그 자체를 삭제할 때 사용합니다.

```http
DELETE /folders/{folderId}/tags/{tagId}
```

성공 시 `200 OK`와 빈 응답 본문이 반환됩니다.

삭제한 태그는 해당 폴더의 모든 클립에서 함께 제거됩니다. 따라서 삭제 확인 문구에 예를 들어 "이 태그가 적용된 클립에서도 태그가 제거됩니다."를 포함하는 것을 권장합니다.

## 클립 태그 저장·교체

클립 편집 화면에서 선택 상태를 저장할 때 사용합니다. 요청의 `tags`에는 태그 ID가 아니라 이름 배열을 넣습니다.

```http
PUT /clips/{clipId}/tags
Content-Type: application/json

{
  "tags": ["중요", "나중에 보기"]
}
```

성공 시 `200 OK`:

```json
{
  "tags": [
    {
      "id": "5f38f251-477a-4a4f-a31e-3ee682d45b93",
      "name": "중요",
      "backgroundColor": "RED"
    },
    {
      "id": "f97fc47c-8b46-4501-b7a6-258bbfc17251",
      "name": "나중에 보기",
      "backgroundColor": "BLUE"
    }
  ]
}
```

동일한 이름이 요청에 여러 번 있어도 서버는 하나로 처리합니다. 응답의 태그 순서는 중복을 제거한 요청 순서를 따릅니다.

### 태그를 모두 해제하는 경우

```http
PUT /clips/{clipId}/tags
Content-Type: application/json

{
  "tags": []
}
```

성공 응답:

```json
{
  "tags": []
}
```

이 요청은 해당 클립과 태그의 연결만 해제합니다. 폴더에 저장된 태그 자체는 삭제하지 않습니다.

### 새 이름을 바로 추가하는 경우

```http
PUT /clips/{clipId}/tags
Content-Type: application/json

{
  "tags": ["중요", "자료 조사"]
}
```

`자료 조사`가 현재 폴더에 없으면 서버가 `GRAY` 색상의 태그를 만들고 클립에 연결합니다.

```json
{
  "tags": [
    {
      "id": "5f38f251-477a-4a4f-a31e-3ee682d45b93",
      "name": "중요",
      "backgroundColor": "RED"
    },
    {
      "id": "b75bd9c0-7675-45c9-a304-9993557b3bda",
      "name": "자료 조사",
      "backgroundColor": "GRAY"
    }
  ]
}
```

새 태그에 별도 색상을 지정해야 한다면 이 API만으로는 색상을 정할 수 없습니다. 먼저 `POST /folders/:folderId/tags`로 태그와 색상을 만들고, 그 이름을 `PUT /clips/:clipId/tags`의 `tags` 배열에 포함합니다.

## 상태 관리 및 UX 권장 사항

- 폴더별 태그 목록은 `folderId`를 포함한 캐시 키로 관리합니다. 예: `['folder-tags', folderId]`.
- 태그 생성·수정·삭제 성공 후에는 해당 폴더의 태그 목록을 갱신하거나 무효화합니다.
- 클립 태그 저장 응답의 `tags`로 현재 클립 UI를 즉시 갱신합니다.
- 클립 태그 저장 중 자동 생성된 태그가 응답에 포함될 수 있으므로, 응답에 새 이름이 있으면 폴더 태그 목록 캐시에도 반영하거나 다시 조회합니다.
- 클립을 다른 폴더로 이동하면 기존 태그 연결은 해제됩니다. 이동 후에는 대상 폴더의 태그 목록을 다시 조회하고 필요하면 새 태그 조합을 저장합니다.
- 사용자 입력 단계에서 이름 길이와 공백 전용 입력을 미리 검증하되, 서버의 `400` 응답도 항상 처리합니다.

## 오류 처리

| 상태 | 대표 원인 | 권장 UX |
| --- | --- | --- |
| `400 Bad Request` | 빈 이름, 10자 초과, 공백 전용 이름, 허용되지 않은 색상, 빈 수정 요청 | 입력값을 유지하고 필드 근처에 검증 메시지를 표시합니다. |
| `401 Unauthorized` | 토큰이 없거나 만료됨 | 로그인 또는 토큰 갱신 흐름으로 보냅니다. |
| `404 Not Found` | 폴더·태그·클립이 없거나 접근할 수 없음 | 최신 목록을 다시 불러오고, 필요하면 이전 화면으로 이동시킵니다. |
| `409 Conflict` | 같은 폴더에 같은 이름의 태그가 이미 있음 | 이름 입력란에 중복 안내를 표시하고 다른 이름을 받습니다. |

오류 응답의 `message`를 사용자에게 그대로 노출하기보다, 상태 코드와 요청한 동작을 기준으로 일관된 한국어 안내 문구를 제공하는 것을 권장합니다.

## 관련 구현 문서

클립 태그 교체 API의 서버 처리 순서와 상세 제약은 [클립 태그 교체 API 흐름](./clip-tag-replacement-api-flow.md)에서 확인할 수 있습니다.
