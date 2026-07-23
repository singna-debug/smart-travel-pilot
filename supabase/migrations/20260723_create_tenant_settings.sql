-- =========================================
-- Smart Travel Pilot - SaaS Migration
-- 테넌트 설정 + 근태관리 테이블 생성
-- =========================================

-- 1. 테넌트(회사) 테이블
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 회사 국문명 (예: 클럽모드 투어)
  english_name TEXT,                     -- 회사 영문명 (예: CLUBMODE TRAVEL)
  manager_name TEXT,                     -- 대표 담당자명
  phone TEXT,                            -- 담당자/대표 연락처
  logo_url TEXT,                         -- 로고 이미지 URL
  work_start_time TIME DEFAULT '09:00',  -- 기본 출근 시간
  work_end_time TIME DEFAULT '18:00',    -- 기본 퇴근 시간
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 테넌트별 암호화 설정 테이블 (민감 정보 포함)
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- 구글 시트 연동
  google_spreadsheet_id TEXT,
  google_sheet_name TEXT DEFAULT '시트1',
  google_client_email TEXT,
  google_private_key TEXT,               -- 암호화하여 저장

  -- Gemini API 및 카카오 연동
  gemini_api_key TEXT,                   -- 암호화하여 저장
  kakao_channel_id TEXT,
  kakao_api_key TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 직원 테이블
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),  -- Supabase Auth 연동
  name TEXT NOT NULL,                       -- 직원명
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'staff',                -- 'owner' | 'manager' | 'staff'
  hire_date DATE,                           -- 입사일 (연차 자동 계산용)
  annual_leave_days NUMERIC DEFAULT 15,     -- 연간 연차 일수
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 출퇴근 기록 테이블
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,                    -- 출근 시각
  clock_out TIMESTAMPTZ,                   -- 퇴근 시각
  work_minutes INTEGER,                    -- 실 근무 분 (자동 계산)
  status TEXT DEFAULT 'normal',            -- 'normal' | 'late' | 'early_leave' | 'absent' | 'off_site' | 'business_trip'
  memo TEXT,                               -- 비고 (사유 등)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)                -- 1인 1일 1레코드
);

-- 5. 휴가/연차 신청 테이블
CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  leave_type TEXT NOT NULL,                -- 'annual' | 'half_day_am' | 'half_day_pm' | 'sick' | 'special'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL DEFAULT 1,         -- 사용 일수 (반차=0.5)
  reason TEXT,
  status TEXT DEFAULT 'pending',           -- 'pending' | 'approved' | 'rejected'
  approved_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 외근/출장 기록 테이블
CREATE TABLE IF NOT EXISTS field_work (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,                      -- 'off_site' (외근) | 'business_trip' (출장/인솔)
  destination TEXT,                        -- 목적지 (예: 보라카이, 공항)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  memo TEXT,
  status TEXT DEFAULT 'pending',           -- 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed'
  approved_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 인덱스 생성
-- =========================================
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_field_work_tenant ON field_work(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_field_work_employee ON field_work(employee_id, status);

-- =========================================
-- RLS (Row Level Security) 정책
-- =========================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_work ENABLE ROW LEVEL SECURITY;
