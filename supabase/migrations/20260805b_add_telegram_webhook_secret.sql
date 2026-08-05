-- chat_id만으로는 "같은 사람이 여러 테넌트 봇을 자기 계정으로 테스트"하는 경우
-- 구분이 불가능하므로(동일 chat_id), 텔레그램 setWebhook의 secret_token을
-- 테넌트별로 발급해 요청 헤더(X-Telegram-Bot-Api-Secret-Token)로 식별한다.
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT;
