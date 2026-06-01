import MessageTemplateCreator from '@/components/MessageTemplateCreator';

export default function MessagesPage() {
    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">✉️ 멘트제작</h1>
                <p className="page-subtitle">고객별 맞춤 메시지를 빠르게 생성합니다</p>
            </header>

            <MessageTemplateCreator />
        </div>
    );
}
