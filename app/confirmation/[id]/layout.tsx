import type { Metadata, ResolvingMetadata } from 'next';
import { confirmationStore } from '@/lib/confirmation-store';

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const doc = await confirmationStore.get(id);

    if (!doc) {
        return {
            title: "여행 확정서 - CLUBMODE TRAVEL",
            description: "여기를 눌러 링크를 확인하세요.",
        };
    }

    const customerName = doc.customer?.name || '고객';
    // 총 인원은 "인원" 입력값(성인+소아+유아)을 우선 사용한다.
    // 여행자 명단(travelers)은 이름을 개별 입력한 사람 수일 뿐이라 실제 인원과 다를 수 있다.
    const countFromFields = (doc.trip?.adultCount || 0) + (doc.trip?.childCount || 0) + (doc.trip?.infantCount || 0);
    const totalTravelers = countFromFields > 0 ? countFromFields : (doc.trip?.travelers?.length || 1);
    const otherCount = totalTravelers - 1;
    const destination = doc.trip?.destination || '여행지';

    let titleStr = `여행 확정서 - ${customerName} 님`;
    if (otherCount > 0) {
        titleStr += ` 외 ${otherCount}명`;
    }
    titleStr += `_${destination}`;

    const description = `${customerName} 님의 ${destination} 여행 확정서입니다. 여기를 눌러 링크를 확인하세요.`;

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
