interface StatusBadgeProps {
    status: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    '상담중': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: '상담중' },
    '견적제공': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: '견적제공' },
    '예약확정': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: '예약확정' },
    '결제완료': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: '결제완료' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    const config = statusConfig[status] || statusConfig['상담중'];

    return (
        <span
            className="status-badge"
            style={{
                color: config.color,
                backgroundColor: config.bg,
                border: `1px solid ${config.color}30`,
            }}
        >
            {config.label}
        </span>
    );
}
