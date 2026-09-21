-- =========================================
-- Smart Travel Pilot - 사용자 정의 멘트(메시지) 템플릿
-- =========================================
-- tenant_id는 기존 tenant_settings와 동일하게 TEXT로 저장합니다.
-- ('default_tenant' 또는 Supabase Auth user.id 문자열)

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,              -- 탭에 표시될 멘트 이름 (예: 여권 안내)
  icon TEXT DEFAULT '💬',           -- 탭에 표시될 이모지 아이콘
  content TEXT NOT NULL,            -- 변수({{고객명}} 등)를 포함한 원본 텍스트
  sort_order INTEGER DEFAULT 0,     -- 탭 정렬 순서
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON message_templates(tenant_id);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- 서버(API Route)는 supabaseAdmin(service role)으로 접근하여 RLS를 우회합니다.
-- 클라이언트에서 직접 접근하는 경로가 없으므로 기본적으로 모든 접근을 차단합니다.
DROP POLICY IF EXISTS "message_templates_service_role_only" ON message_templates;
CREATE POLICY "message_templates_service_role_only" ON message_templates
  FOR ALL USING (false) WITH CHECK (false);
