'use client';

import { use } from 'react';
import ChatViewer from '@/components/ChatViewer';

interface ChatDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function ChatDetailPage({ params }: ChatDetailPageProps) {
    const { id } = use(params);

    return (
        <div>
            <ChatViewer chatId={id} />
        </div>
    );
}
