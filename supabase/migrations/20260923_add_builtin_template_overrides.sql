-- =========================================
-- Smart Travel Pilot - 고정(빌트인) 멘트 템플릿 수정 지원
-- =========================================
-- message_templates 테이블에 builtin_key 컬럼을 추가합니다.
-- - builtin_key가 NULL이면: 사용자가 새로 만든 "커스텀 멘트"
-- - builtin_key가 채워져 있으면: 기존 10개 고정 멘트(remind, booking, ...)의
--   문구를 사용자가 고쳐서 저장한 "오버라이드" 레코드

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS builtin_key TEXT;

-- 테넌트별로 같은 빌트인 멘트를 중복 저장하지 않도록 유니크 인덱스 부여
-- (builtin_key가 NULL인 커스텀 멘트는 유니크 제약에서 자동 제외됨 - Postgres의 NULL 비교 특성)
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_tenant_builtin
  ON message_templates(tenant_id, builtin_key)
  WHERE builtin_key IS NOT NULL;
