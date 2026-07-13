# Easy Clip 아키텍처 가이드 스킬

이 스킬은 Easy Clip 백엔드 코드를 추가하거나 수정할 때 파일 위치와 의존성 방향을 일관되게 판단하도록 돕는 저장소 전용 가이드입니다.

다음 작업에서 사용합니다.

- 새로운 API와 유스케이스 구현
- 기능 도메인 추가 또는 기존 구조 리팩터링
- DTO, Entity, Repository interface, Prisma 구현체 배치
- 기능 도메인 간 import와 공통 인증 계약 검토
- 유스케이스 테스트, Prisma 스키마 및 환경 설정 변경
- 아키텍처 관점의 코드 리뷰

핵심 목표는 `presentation`, `application`, `domain`, `infrastructure`의 책임을 분리하고, 기능 도메인 간 내부 구현 참조를 막으며, 여러 기능 도메인이 공유하는 계약만 `src/shared`에서 관리하는 것입니다.

실제 작업 지침은 같은 폴더의 `SKILL.md`를 기준으로 합니다.
