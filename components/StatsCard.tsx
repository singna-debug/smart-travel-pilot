interface StatsCardProps {
    value: number | string;
    label: string;
    isActive?: boolean;
    isUrgent?: boolean;
    overdueValue?: number;
}

export default function StatsCard({ value, label, isActive, isUrgent, overdueValue }: StatsCardProps) {
    return (
        <div className={`stats-card ${isActive ? 'active' : ''} ${isUrgent ? 'urgent' : ''}`}>
            <div className="stats-content">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <div className="stats-value">{value}</div>
                    {overdueValue !== undefined && overdueValue > 0 && (
                        <div style={{
                            color: '#f87171',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            +{overdueValue}
                        </div>
                    )}
                </div>
                <div className="stats-label">{label}</div>
            </div>
        </div>
    );
}
