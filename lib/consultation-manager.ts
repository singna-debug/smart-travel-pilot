import { supabase } from './supabase';
import { extractConsultationData } from './ai-engine';
import { upsertConsultationToSheet } from './google-sheets';
import { ConsultationData } from '@/types';

/**
 * 대화 내역을 분석하여 정보를 추출하고 Supabase와 구글 시트를 자동으로 업데이트합니다.
 */
export async function syncConsultationWithAI(visitorId: string): Promise<boolean> {
    try {
        if (!supabase) {
            console.error('[Sync] Supabase client not initialized');
            return false;
        }

        // 1. 대화 내역 가져오기 (Supabase message_logs)
        const { data: messages, error: msgError } = await supabase
            .from('message_logs')
            .select('role, content')
            .eq('visitor_id', visitorId)
            .order('created_at', { ascending: true });

        if (msgError || !messages || messages.length === 0) {
            console.warn(`[Sync] No messages found for ${visitorId}`);
            return false;
        }

        // 2. AI 데이터 추출 호출
        const extractedData = await extractConsultationData(messages);
        if (!extractedData || Object.keys(extractedData).length === 0) {
            console.error(`[Sync] AI extraction failed for ${visitorId}`);
            return false;
        }

        // 3. Supabase 업데이트
        const { error: upsertError } = await supabase
            .from('consultations')
            .upsert({
                visitor_id: visitorId,
                customer_name: extractedData.customer?.name,
                customer_phone: extractedData.customer?.phone,
                destination: extractedData.trip?.destination,
                departure_date: extractedData.trip?.departure_date,
                status: extractedData.automation?.status,
                summary: extractedData.summary,
                updated_at: new Date().toISOString()
            }, { onConflict: 'visitor_id' });

        if (upsertError) {
            console.error('[Sync] Supabase update failed:', upsertError);
            return false;
        }

        // 4. 구글 시트 업서트
        const sheetData: ConsultationData = {
            visitor_id: visitorId,
            customer: extractedData.customer!,
            trip: extractedData.trip!,
            automation: extractedData.automation!,
            summary: extractedData.summary!,
            timestamp: new Date().toISOString() as any // 타입 호환을 위해 casting
        };

        await upsertConsultationToSheet(sheetData);

        console.log(`[Sync] Successfully synced consultation for ${visitorId}`);
        return true;

    } catch (error) {
        console.error(`[Sync] Fatal error syncing ${visitorId}:`, error);
        return false;
    }
}
