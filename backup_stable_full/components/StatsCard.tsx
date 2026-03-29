interface StatsCardProps {
    value: number | string;
    label: string;
    isActive?: boolean;
    isUrgent?: boolean;
}

export default function StatsCard({ value, label, isActive, isUrgent }: StatsCardProps) {
    return (
        <div className={`stats-card ${isActive ? 'active' : ''} ${isUrgent ? 'urgent' : ''}`}>
            <div className="stats-content">
                <div className="stats-value">{value}</div>
                <div className="stats-label">{label}</div>
            </div>
        </div>
    );
}
