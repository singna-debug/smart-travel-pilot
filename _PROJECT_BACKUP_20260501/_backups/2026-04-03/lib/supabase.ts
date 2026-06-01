import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * [Supabase 테이블 생성 SQL]
 * Supabase SQL Editor에서 아래 코드를 실행해주시면 됩니다.
 * 
 * -- 상담 요약 테이블
 * CREATE TABLE IF NOT EXISTS consultations (
 *   id BIGSERIAL PRIMARY KEY,
 *   visitor_id TEXT NOT NULL UNIQUE,
 *   customer_name TEXT,
 *   customer_phone TEXT,
 *   destination TEXT,
 *   product_name TEXT,
 *   departure_date TEXT,
 *   url TEXT,
 *   status TEXT,
 *   balance_due_date TEXT,
 *   notice_date TEXT,
 *   next_followup TEXT,
 *   summary TEXT,
 *   is_bot_enabled BOOLEAN DEFAULT TRUE,
 *   last_callback_url TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 기존 테이블에 컬럼 추가 (이미 테이블이 있는 경우)
 * -- ALTER TABLE consultations ADD COLUMN IF NOT EXISTS is_bot_enabled BOOLEAN DEFAULT TRUE;
 * -- ALTER TABLE consultations ADD COLUMN IF NOT EXISTS last_callback_url TEXT;
 * -- ALTER TABLE consultations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
 * 
 * -- 메시지 로그 테이블
 * CREATE TABLE IF NOT EXISTS message_logs (
 *   id BIGSERIAL PRIMARY KEY,
 *   visitor_id TEXT NOT NULL,
 *   role TEXT NOT NULL, -- 'user' or 'assistant'
 *   content TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 인덱스 생성
 * CREATE INDEX IF NOT EXISTS idx_consultations_visitor_id ON consultations(visitor_id);
 * CREATE INDEX IF NOT EXISTS idx_message_logs_visitor_id ON message_logs(visitor_id);
 */
