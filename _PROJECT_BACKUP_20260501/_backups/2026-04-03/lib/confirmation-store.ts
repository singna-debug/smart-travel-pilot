import type { ConfirmationDocument } from '@/types';
import { supabase } from './supabase';

/**
 * 확정서 데이터 저장소
 * 기존 인메모리 방식에서 Supabase 영구 저장 방식으로 전환되었습니다.
 */

export const confirmationStore = {
    get: async (id: string): Promise<ConfirmationDocument | null> => {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('mobile_confirmations')
            .select('data')
            .eq('id', id)
            .single();

        if (error || !data) return null;
        return data.data as ConfirmationDocument;
    },

    set: async (id: string, doc: ConfirmationDocument): Promise<boolean> => {
        if (!supabase) {
            console.error('Supabase client not initialized');
            return false;
        }
        const { error } = await supabase
            .from('mobile_confirmations')
            .upsert({
                id,
                data: doc,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Supabase Error:', error.message);
            return false;
        }
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
