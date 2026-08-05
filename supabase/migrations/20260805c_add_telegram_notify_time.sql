-- 테넌트별 아침 업무 브리핑 알림 발송 시각(HH:mm, KST 기준) 설정 + 중복 발송 방지용 마지막 발송일
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS telegram_notify_time TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS telegram_last_notified_date TEXT;
