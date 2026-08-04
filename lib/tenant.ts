import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';

export const DEFAULT_TENANT_ID = 'default_tenant';

/**
 * 테넌트 정보 타입
 */
export interface TenantInfo {
  tenantId: string;
  name: string;
  isDefault: boolean;
}

/**
 * 클라이언트 / 서버 공통: 현재 요청 또는 세션의 Tenant ID 식별
 */
export function getTenantIdFromHeaderOrQuery(req?: any): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tenant_id');
    if (saved && saved !== 'undefined' && saved !== 'null') {
      return saved;
    }

    const tenantSetting = localStorage.getItem('tenant_settings');
    if (tenantSetting) {
      try {
        const parsed = JSON.parse(tenantSetting);
        if (parsed.email === 'gktla71@gmail.com') return DEFAULT_TENANT_ID;
        if (parsed.tenantId) return parsed.tenantId;
      } catch (e) {}
    }
  }

  // 2. Server side: request headers or query
  if (req) {
    const headerTenant = req.headers?.get?.('x-tenant-id') || req.headers?.['x-tenant-id'];
    if (headerTenant && headerTenant !== 'null' && headerTenant !== 'undefined') {
      return headerTenant;
    }

    try {
      const url = new URL(req.url || 'https://localhost');
      const queryTenant = url.searchParams.get('tenant_id');
      if (queryTenant) return queryTenant;
    } catch (e) {}
  }

  return DEFAULT_TENANT_ID;
}

/**
 * API 키 보안 격리: 오직 사장님 계정(default_tenant)만 서버의 .env.local Google/Gemini API 키를 사용하며,
 * 신규 가입 사용자는 본인이 [⚙️ 설정]에서 직접 입력한 키만 사용하도록 100% 격리
 */
export function getTenantApiKeys(tenantId: string, customSettings?: { googleSpreadsheetId?: string; geminiApiKey?: string }) {
  if (tenantId === DEFAULT_TENANT_ID) {
    return {
      googleSpreadsheetId: process.env.GOOGLE_SHEET_ID?.trim() || null,
      geminiApiKey: process.env.GEMINI_API_KEY?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() || null,
      isDefaultOwner: true
    };
  }

  // 신규 가입 아이디: 사장님 API 키 공유 100% 차단!
  return {
    googleSpreadsheetId: customSettings?.googleSpreadsheetId?.trim() || null,
    geminiApiKey: customSettings?.geminiApiKey?.trim() || null,
    isDefaultOwner: false
  };
}

/**
 * 실제 크롤러/AI 호출부에서 사용할 테넌트별 Gemini API 키 조회.
 * 사장님 계정(default_tenant)은 [설정]에 입력한 키가 있으면 그것을, 없으면 서버 .env의 키를 사용.
 * 신규 가입 사용자는 오직 본인이 [설정]에서 등록한 키만 사용 (서버 기본 키로 폴백하지 않음).
 */
export async function getGeminiApiKeyForTenant(tenantId: string): Promise<string | null> {
  let dbKey: string | null = null;

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('tenant_settings')
        .select('gemini_api_key')
        .eq('tenant_id', tenantId)
        .single();
      dbKey = data?.gemini_api_key?.trim() || null;
    } catch (e) {
      // 설정이 없는 신규 사용자 등: 조회 실패는 무시하고 null 처리
    }
  }

  if (dbKey) return dbKey;

  if (tenantId === DEFAULT_TENANT_ID) {
    return process.env.GEMINI_API_KEY?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() || null;
  }

  return null;
}

/**
 * 신규 테넌트 가입 초기화
 */
export async function initializeNewTenant(tenantId: string, companyName: string, managerName: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Tenants 테이블 생성
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .upsert({
      id: tenantId,
      name: companyName,
      manager_name: managerName
    })
    .select()
    .single();

  if (tenantErr) {
    console.warn('Tenant upsert warning:', tenantErr);
  }

  // 2. Tenant Settings 기본값 생성
  await supabase
    .from('tenant_settings')
    .upsert({
      tenant_id: tenantId
    });

  return tenant;
}
