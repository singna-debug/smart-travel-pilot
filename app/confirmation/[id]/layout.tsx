import type { Metadata, ResolvingMetadata } from 'next';
import { confirmationStore } from '@/lib/confirmation-store';

type Props = {
    params: { id: string };
};

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const id = params.id;
    const doc = await confirmationStore.get(id);

    if (!doc) {
        return {
            title: "Confirm - CLUBMODE TRAVEL",
            description: "Travel Confirmation Viewer",
        };
    }

    const customerName = doc.customer?.name || '고객';
    const totalTravelers = doc.trip?.travelers?.length || 1;
    const otherCount = totalTravelers - 1;
    const destination = doc.trip?.destination || '여행지';

    let titleStr = `여행 확정서 - ${customerName} 님`;
    if (otherCount > 0) {
        titleStr += ` 외 ${otherCount}명`;
    }
    titleStr += `_${destination}`;

    const description = `${customerName} 님의 ${destination} 여행 확정서입니다. 일정을 확인해 보세요.`;

    return {
        title: titleStr,
        description: description,
        openGraph: {
            title: titleStr,
            description: description,
            type: 'website',
            siteName: 'CLUBMODE TRAVEL',
        }
    };
}

export default function ConfirmationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
