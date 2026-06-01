import type { ConfirmationDocument } from '@/types';
import { supabase } from './supabase';

/**
 * 확정서 데이터 저장소
 * Supabase 영구 저장 방식
 */

export const confirmationStore = {
    get: async (id: string): Promise<ConfirmationDocument | null> => {
        if (!supabase || !id) return null;
        
        console.log(`[ConfirmationStore] GET: ${id}`);
        
        // 1. 기본 ID로 조회
        let { data, error } = await supabase
            .from('mobile_confirmations')
            .select('data')
            .eq('id', id)
            .maybeSingle();

        // 2. 못 찾으면 data 내부의 reservationNumber로 재조회
        if (!data) {
            const { data: fallbackData } = await supabase
                .from('mobile_confirmations')
                .select('data')
                .eq('data->>reservationNumber', id)
                .maybeSingle();
            
            if (fallbackData) data = fallbackData;
        }

        // 3. 못 찾으면 data 내부의 id로도 재조회
        if (!data) {
            const { data: fallbackData2 } = await supabase
                .from('mobile_confirmations')
                .select('data')
                .eq('data->>id', id)
                .maybeSingle();
            
            if (fallbackData2) data = fallbackData2;
        }

        if (!data) {
            console.log(`[ConfirmationStore] NOT FOUND: ${id}`);
            return null;
        }

        console.log(`[ConfirmationStore] FOUND: ${id}`);
        return data.data as ConfirmationDocument;
    },

    set: async (id: string, doc: ConfirmationDocument): Promise<boolean> => {
        if (!supabase) {
            console.error('Supabase client not initialized');
            return false;
        }

        console.log(`[ConfirmationStore] SET: ${id}`);

        const { error } = await supabase
            .from('mobile_confirmations')
            .upsert({
                id,
                data: doc,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('[ConfirmationStore] Supabase Error:', error.message);
            return false;
        }
        
        console.log(`[ConfirmationStore] SAVED: ${id}`);
        return true;
    },

    delete: async (id: string): Promise<boolean> => {
        if (!supabase) return false;
        const { error } = await supabase
            .from('mobile_confirmations')
            .delete()
            .eq('id', id);

        return !error;
    },

    list: async (): Promise<ConfirmationDocument[]> => {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('mobile_confirmations')
            .select('data')
            .order('created_at', { ascending: false });

        if (error || !data) return [];
        return data.map(item => item.data as ConfirmationDocument);
    },

    has: async (id: string): Promise<boolean> => {
        if (!supabase) return false;
        const { count, error } = await supabase
            .from('mobile_confirmations')
            .select('id', { count: 'exact', head: true })
            .eq('id', id);

        return !error && count !== null && count > 0;
    },
};
