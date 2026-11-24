# 오션스펍 PostgreSQL 테이블 상세 설계

이 문서는 [구현 명세](implementation-spec.md)의 데이터 모델을 마이그레이션으로 옮기기 위한 설계다. 기본 환경은 관리형 Supabase PostgreSQL 무료 플랜이며 환경별 백업·복구 요구에 따라 요금제를 재검토한다.

## 컬럼과 키

표의 PK는 기본 키, FK는 외래 키, UQ는 유일 제약이다. 별도 표시가 없으면 필수 컬럼이다. 일반 엔티티의 `id`는 `uuid PRIMARY KEY DEFAULT gen_random_uuid()`다. 생성 시각은 `timestamptz DEFAULT now()`로 기록하고 경기일·주차·월은 한국 시간 기준 `date`로 저장한다. 월 키는 매월 1일, 주차 키는 월요일이다.

| 테이블 | 컬럼과 타입 | 키·제약 |
|---|---|---|
| `staff` | `auth_user_id uuid`, `role text`, `active boolean`, `created_at timestamptz` | PK/FK `auth_user_id → auth.users.id`. 역할은 `owner` 또는 `staff`. 퇴사 시 비활성화 |
| `members` | `id uuid`, `nickname text`, `nickname_key text`, `created_at timestamptz` | UQ `nickname_key`. 앞뒤 공백 제거·NFC 정규화·대소문자 정규화 후 키 생성 |
| `game_types` | `id uuid`, `code text`, `name text`, `active boolean`, `current_version_id uuid NULL` | UQ `code`, `name`. 현재 버전은 동일 종류의 버전만 참조 |
| `game_rule_versions` | `id uuid`, `game_type_id uuid`, `version integer`, `created_by uuid`, `created_at timestamptz` | FK 게임 종류·직원. UQ `(game_type_id, version)` 및 복합 FK용 `(game_type_id, id)`. 발행 후 불변 |
| `game_rank_rules` | `version_id uuid`, `rank integer`, `points integer`, `buy_in_qty integer`, `ticket_qty integer` | PK `(version_id, rank)`, FK 규칙 버전. 순위 ≥ 1, 나머지 수량 ≥ 0 |
| `games` | `id uuid`, `game_date date`, `game_type_id uuid`, `rule_version_id uuid`, `revision integer`, `created_by uuid`, `updated_by uuid`, `created_at timestamptz`, `updated_at timestamptz` | 복합 FK `(game_type_id, rule_version_id)`로 종류·버전 일치 강제. `revision ≥ 1`. 정정 시 1 증가 |
| `game_results` | `game_id uuid`, `member_id uuid`, `rank integer`, `points integer`, `buy_in_qty integer`, `ticket_qty integer` | PK `(game_id, member_id)`, UQ `(game_id, rank)`, FK 경기·회원. 양수 순위, 비음수 결과 수량. 연속 순위는 경기 저장 함수에서 검증 |
| `bingo_boards` | `id uuid`, `month date`, `three_line_prize text`, `full_prize text` | UQ `month`. 월 초일 검사 |
| `bingo_cells` | `id uuid`, `board_id uuid`, `position smallint`, `label text` | UQ `(board_id, position)`. 위치 1~9. 보드와 9개 칸은 한 트랜잭션에서 저장 |
| `bingo_completions` | `cell_id uuid`, `member_id uuid`, `recorded_by uuid`, `recorded_at timestamptz` | PK `(cell_id, member_id)`. 달성 취소를 감사 이력에 남김 |
| `mission_templates` | `id uuid`, `label text`, `active_from_month date`, `archived_from_month date NULL`, `sort_order integer` | 적용 월과 보관 월은 초일. 보관 월은 적용 월보다 이후. 입력 최대 개수 제한 없음 |
| `mission_months` | `id uuid`, `month date` | UQ `month`. 월 초일 검사 |
| `mission_month_items` | `id uuid`, `mission_month_id uuid`, `template_id uuid`, `label_snapshot text`, `sort_order integer` | UQ `(mission_month_id, template_id)`. 과거 월의 미션 이름·표시 순서 보존 |
| `mission_completions` | `month_item_id uuid`, `member_id uuid`, `recorded_by uuid`, `recorded_at timestamptz` | PK `(month_item_id, member_id)`. 달성 취소를 감사 이력에 남김 |
| `reward_settings` | `kind text`, `milestone smallint`, `label text` | PK `(kind, milestone)`. 허용 조합은 `weekly` 1~5, `monthly` 1·4·5, `stars` 20 |
| `mission_month_rewards` | `mission_month_id uuid`, `milestone smallint`, `label text` | PK `(mission_month_id, milestone)`. 단계 1·4·5, 월별 지급 기준의 이름 스냅샷 |
| `star_missions` | `id uuid`, `name text`, `archived_at timestamptz NULL` | 활성 이름 부분 UQ. 삭제는 보관 처리 |
| `star_accounts` | `member_id uuid`, `balance bigint DEFAULT 0`, `updated_at timestamptz` | PK/FK `member_id`. 잔액 ≥ 0. 변경 시 이 행을 잠금 |
| `star_ledger` | `id uuid`, `member_id uuid`, `event_type text`, `delta bigint`, `balance_after bigint`, `star_mission_id uuid NULL`, `mission_name_snapshot text NULL`, `prize_payment_id uuid NULL`, `request_id uuid`, `recorded_by uuid`, `created_at timestamptz` | UQ `request_id`. 지급은 양수, 교환은 −20, 교환 취소는 +20. 교환·취소는 지급 건 참조. 기초 잔액 이관은 `opening_balance`로 구분. 행은 추가만 가능 |
| `prize_payments` | `id uuid`, `member_id uuid`, `kind text`, `period_start date NULL`, `milestone smallint`, `reward_snapshot text`, `evidence_snapshot jsonb`, `request_id uuid`, `paid_by uuid`, `paid_at timestamptz`, `voided_at timestamptz NULL` | UQ `request_id`. 종류별 유효 단계·기간 검사. 빙고·월간은 월 초일, 주간은 월요일, 별은 기간 없음. 원래 지급 내용은 변경 불가 |
| `prize_payment_voids` | `payment_id uuid`, `request_id uuid`, `reason text`, `voided_by uuid`, `voided_at timestamptz` | PK/FK `payment_id`, UQ `request_id`. 지급 건당 한 번. 지급의 `voided_at`와 같은 트랜잭션으로 기록 |
| `audit_events` | `id uuid`, `actor_id uuid`, `entity_type text`, `entity_id uuid`, `action text`, `before_data jsonb NULL`, `after_data jsonb NULL`, `reason text NULL`, `request_id uuid`, `created_at timestamptz` | 감사 행은 추가만 가능. 자동화·이관 계정은 별도 직원 ID로 식별 |

기타 FK는 컬럼 이름에 해당하는 엔티티를 참조한다. 회원, 경기, 규칙, 프라이즈 및 원장과 연결된 운영 기록의 물리 삭제는 기본적으로 제한한다. 지급 이력이 사라지지 않도록 이력 생성 후 닉네임·프라이즈 이름 등 지급 근거를 스냅샷에 보존한다.

### 활성 지급 유일성 및 조회 인덱스

- 주간 랭킹은 `(period_start, member_id)`에 `kind = 'weekly' AND voided_at IS NULL` 부분 유니크 인덱스를 둔다.
- 월간 미션과 빙고는 `(kind, period_start, member_id, milestone)`에 `kind IN ('monthly', 'bingo') AND voided_at IS NULL` 부분 유니크 인덱스를 둔다. 빙고 단계는 3줄을 `3`, 올빙고를 `9`로 저장한다.
- 별 교환은 회원당 횟수 제한 없이 요청 ID 중복과 비음수 잔액으로 통제한다.
- 일반 인덱스는 `games(game_date)`, `game_results(member_id, game_id)`, `bingo_completions(member_id, cell_id)`, `mission_completions(member_id, month_item_id)`, `prize_payments(paid_at DESC)`, `star_ledger(member_id, created_at DESC)`부터 시작한다. 복합 키의 첫 컬럼과 중복되는 인덱스는 쿼리 계획을 확인한 뒤 결정한다.

## 트랜잭션 계약

| 작업 | 한 트랜잭션에서 처리할 내용 |
|---|---|
| 게임 규칙 수정 | 새 규칙 버전 발행 → 순위별 배점·프라이즈 삽입 → 종류의 현재 버전 교체 |
| 경기 저장·정정 | 정정 시 경기 행 잠금 및 수정 버전 검증 → 신규 회원 생성 또는 기존 키 조회 → 참가 결과 검증 및 저장 → 감사 기록. 경기 종류가 같으면 기존 규칙 버전을 사용 |
| 월간 미션 초기화 | 기준 월을 생성하거나 조회 → 그 월에 유효한 템플릿 복사 → 단계 보상 스냅샷 저장. `ON CONFLICT`로 동시 초기화 재시도 처리 |
| 일반 프라이즈 지급 | 요청 ID 확인 → 기간별 자격 재계산 → 활성 지급 고유성 검사 → 지급 및 근거 저장. 중복 요청은 원래 결과 반환 |
| 별 지급·교환 | 계정 행 생성 또는 조회 후 `FOR UPDATE` → 잠금 안에서 요청 ID 재확인 → 교환 자격 확인 → 잔액·원장·프라이즈 기록 갱신. 실패하면 모두 롤백 |
| 지급 취소 | 지급 행 잠금 → 권한·사유·취소 여부 검사 → 별이면 동일 계정 행 잠금·복구 원장 생성 → 취소 기록과 지급 상태 갱신 |

## Supabase 운영 절차와 접근

- **DDL**은 저장소의 `supabase/migrations`에 버전별 SQL로 관리한다. 테이블, 인덱스, 제약, RLS 정책, 트랜잭션 함수 변경을 리뷰하고 개발·검증 환경에서 적용한 뒤 운영으로 승격한다. 적용된 파일을 고치는 대신 후속 마이그레이션을 추가한다.
- **DML**은 초기 운영 설정, 별도 검증용 시드, 목업 데이터 이관, 운영 데이터 정정과 조회를 분리한다. 일상적인 입력은 관리자 UI와 서버 API로 처리한다. 일괄 이관·정정은 대상 목록과 영향 건수를 먼저 확인하고, 승인된 범위만 실행하며 감사 이력을 남긴다.
- **접근 범위**는 프로젝트 개설 후 작업 환경이 연결 가능한지와 어떤 역할을 부여받았는지에 따라 달라진다. DDL 적용에는 마이그레이션 권한이 있는 DB 연결이 필요하다. PostgREST의 공개 키나 서버 API 키만으로는 일반적인 스키마 변경 권한을 대체할 수 없다. DML은 테이블과 함수에 필요한 권한만 부여한 연결로 실행한다.
- 개발·검증·운영 연결을 분리한다. DB 연결 정보는 승인된 환경 시크릿 경로로 제공하고 채팅·저장소·브라우저에 노출하지 않는다. 접속 권한을 받기 전에도 SQL 작성, 코드 리뷰, 로컬 검증은 가능하다.
- 업무 테이블에 RLS를 활성화하고 `anon` 및 일반 `authenticated` 역할의 직접 쓰기 권한을 제거한다. 관리자 서버는 세션과 활성 직원 상태를 검사한 뒤 제한된 DB 역할로 실행한다. 공개 게스트는 서버가 가공한 필드만 읽는다. DB 함수에는 최소 실행 권한을 부여하고, 권한 상승이 꼭 필요한 함수는 고정된 `search_path`와 명시적 스키마 이름을 사용한다.
- 운영 환경 적용 전 대상 프로젝트와 마이그레이션 상태, 최근 백업 및 복구 경로를 확인한다. 데이터 삭제·대량 정정 같은 작업은 실행 계획과 복구 방법을 먼저 검토한다.
