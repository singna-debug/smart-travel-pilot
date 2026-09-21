import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * GET /api/message-templates
 * 현재 테넌트가 만든 사용자 정의 멘트 템플릿 목록 조회
 */
export async function GET(request: NextRequest) {
    try {
        const tenantId = await getTenantId(request);

        if (!supabaseAdmin) {
            return NextResponse.json({ success: true, templates: [] });
        }

        const { data, error } = await supabaseAdmin
            .from('message_templates')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[MessageTemplates GET] Supabase error:', error.message);
            return NextResponse.json({ success: true, templates: [] });
        }

        const templates = (data || []).map((row) => ({
            id: row.id,
            label: row.label,
            icon: row.icon || '💬',
            content: row.content,
            sortOrder: row.sort_order || 0,
            builtinKey: row.builtin_key || null,
        }));

        return NextResponse.json({ success: true, templates });
    } catch (error: any) {
        console.error('[MessageTemplates GET] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/message-templates
 * - builtinKey가 없으면: 새 사용자 정의 멘트 템플릿 생성
 * - builtinKey가 있으면: 고정(빌트인) 멘트의 문구 오버라이드를 upsert
 *   (해당 테넌트에 이미 같은 builtinKey 오버라이드가 있으면 갱신, 없으면 생성)
 * Body: { label, icon?, content, builtinKey? }
 */
export async function POST(request: NextRequest) {
    try {
        const tenantId = await getTenantId(request);
        const body = await request.json();
        const { label, icon, content, builtinKey } = body;

        if (!label || !label.trim()) {
            return NextResponse.json({ success: false, error: '멘트 이름을 입력해주세요.' }, { status: 400 });
        }
        if (!content || !content.trim()) {
            return NextResponse.json({ success: false, error: '멘트 내용을 입력해주세요.' }, { status: 400 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Supabase가 연결되지 않았습니다.' }, { status: 500 });
        }

        if (builtinKey) {
            // 빌트인 멘트 오버라이드: upsert (tenant_id + builtin_key 유니크 인덱스 기준)
            const { data, error } = await supabaseAdmin
                .from('message_templates')
                .upsert(
                    {
                        tenant_id: tenantId,
                        builtin_key: builtinKey,
                        label: label.trim(),
                        icon: icon || '💬',
                        content,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'tenant_id,builtin_key' }
                )
                .select()
                .single();

            if (error) {
                console.error('[MessageTemplates POST builtin] Supabase error:', error.message);
                return NextResponse.json({ success: false, error: `저장 실패: ${error.message}` }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                template: {
                    id: data.id,
                    label: data.label,
                    icon: data.icon || '💬',
                    content: data.content,
                    sortOrder: data.sort_order || 0,
                    builtinKey: data.builtin_key || null,
                },
            });
        }

        // 정렬 순서: 기존 커스텀 템플릿 개수 뒤에 추가
        const { count } = await supabaseAdmin
            .from('message_templates')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);

        const { data, error } = await supabaseAdmin
            .from('message_templates')
            .insert({
                tenant_id: tenantId,
                label: label.trim(),
                icon: icon || '💬',
                content,
                sort_order: count || 0,
            })
            .select()
            .single();

        if (error) {
            console.error('[MessageTemplates POST] Supabase error:', error.message);
            return NextResponse.json({ success: false, error: `저장 실패: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            template: {
                id: data.id,
                label: data.label,
                icon: data.icon || '💬',
                content: data.content,
                sortOrder: data.sort_order || 0,
                builtinKey: null,
            },
        });
    } catch (error: any) {
        console.error('[MessageTemplates POST] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/message-templates
 * 기존 사용자 정의 멘트 템플릿 수정
 * Body: { id, label?, icon?, content? }
 */
export async function PUT(request: NextRequest) {
    try {
        const tenantId = await getTenantId(request);
        const body = await request.json();
        const { id, label, icon, content } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
        }
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Supabase가 연결되지 않았습니다.' }, { status: 500 });
        }

        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (label !== undefined) {
            if (!label.trim()) {
                return NextResponse.json({ success: false, error: '멘트 이름을 입력해주세요.' }, { status: 400 });
            }
            updateData.label = label.trim();
        }
        if (icon !== undefined) updateData.icon = icon;
        if (content !== undefined) {
            if (!content.trim()) {
                return NextResponse.json({ success: false, error: '멘트 내용을 입력해주세요.' }, { status: 400 });
            }
            updateData.content = content;
        }

        // 다른 테넌트의 템플릿을 수정하지 못하도록 tenant_id로 스코프 제한
        const { data, error } = await supabaseAdmin
            .from('message_templates')
            .update(updateData)
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) {
            console.error('[MessageTemplates PUT] Supabase error:', error.message);
            return NextResponse.json({ success: false, error: `수정 실패: ${error.message}` }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ success: false, error: '해당 멘트를 찾을 수 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            template: {
                id: data.id,
                label: data.label,
                icon: data.icon || '💬',
                content: data.content,
                sortOrder: data.sort_order || 0,
                builtinKey: data.builtin_key || null,
            },
        });
    } catch (error: any) {
        console.error('[MessageTemplates PUT] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/message-templates?id=xxx
 * 사용자 정의 멘트 템플릿 삭제
 */
export async function DELETE(request: NextRequest) {
    try {
        const tenantId = await getTenantId(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
        }
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Supabase가 연결되지 않았습니다.' }, { status: 500 });
        }

        const { error } = await supabaseAdmin
            .from('message_templates')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (error) {
            console.error('[MessageTemplates DELETE] Supabase error:', error.message);
            return NextResponse.json({ success: false, error: `삭제 실패: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[MessageTemplates DELETE] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
