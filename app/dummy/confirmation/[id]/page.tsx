import ConfirmationDetail from '../../../confirmation/[id]/page';

export default function DummyConfirmationDetail({ params }: { params: Promise<{ id: string }> }) {
    return <ConfirmationDetail params={params} isDummy={true} />;
}
