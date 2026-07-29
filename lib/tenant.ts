import { createClient } from '@supabase/supabase-js';

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
    // gktla71@gmail.com 이거나 비어있으면 무조건 default_tenant!
    const saved = localStorage.getItem('tenant_id');
    if (!saved || saved === 'default_tenant') return DEFAULT_TENANT_ID;

    // 만약 tenant_id가 설정되어있더라도 gktla71@gmail.com 인 경우 default_tenant 강제 적용
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
