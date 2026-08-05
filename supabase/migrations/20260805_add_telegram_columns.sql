-- =========================================
-- 테넌트별 텔레그램 봇 연동 컬럼 추가
-- (지금까지는 이 컬럼이 없어서 텔레그램 설정이 로컬 파일에만 저장되고,
--  웹훅은 항상 default_tenant로만 동작했음)
-- =========================================

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_notify_enabled BOOLEAN DEFAULT TRUE;
