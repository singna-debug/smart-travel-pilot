'use client';

import ManualConsultationForm from '@/components/ManualConsultationForm';

export default function ManualLogPage() {
    return (
        <div className="manual-log-page" style={{ width: '100%', boxSizing: 'border-box' }}>
            <ManualConsultationForm />
            
            <style jsx>{`
                @media (max-width: 768px) {
                    .manual-log-page { width: 100% !important; padding: 0 !important; }
                }
            `}</style>
        </div>
    );
}
