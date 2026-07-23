import { Metadata, ResolvingMetadata } from 'next';
import { generateMetadata as originalGenerateMetadata } from '../../../confirmation/[id]/layout';
import ConfirmationLayout from '../../../confirmation/[id]/layout';

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    return originalGenerateMetadata({ params }, parent);
}

export default ConfirmationLayout;
