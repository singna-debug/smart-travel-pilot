'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line, Area, AreaChart,
    ComposedChart,
} from 'recharts';
import { TrendingUp, Users, Globe, ArrowRightLeft, Calendar, BarChart3, RefreshCw, Lightbulb, FileText } from 'lucide-react';

interface AnalyticsData {
    period: number;
    totalRecords: number;
    totalSourceInquiries: number;
    newVsReturning: { name: string; value: number; color: string }[];
    inquirySource: { name: string; value: number; converted: number; conversionRate: number; color: string }[];
    topDestinations: { name: string; inquiries: number; bookings: number; color: string }[];
    conversionData: { name: string; value: number; color: string }[];
    conversionRate: number;
    conversionTrend: { name: string; 문의: number; 전환: number; 전환율: number }[];
    sourceTrends: Record<string, { name: string; 문의: number; 전환: number; 전환율: number }[]>;
    leadTimeData: { name: string; value: number }[];
}

const PERIOD_OPTIONS = [
    { label: '최근 7일', value: 7 },
    { label: '최근 30일', value: 30 },
    { label: '최근 90일', value: 90 },
];

// 도넛 안쪽 퍼센트만 표시 (외부 라벨 제거, 호버 시 툴팁으로 이름 표시)
const renderInnerPercent = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ── 커스텀 툴팁 ──
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            color: '#e2e8f0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: '220px',
        }}>
            {label && <p style={{ fontWeight: 700, marginBottom: '6px', color: '#fff' }}>{label}</p>}
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color || p.payload?.color || '#94a3b8', margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span>{p.name || p.payload?.name}</span>
                    <strong style={{ color: '#fff' }}>
                        {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                        {p.name === '전환율' ? '%' : '건'}
                    </strong>
                </p>
            ))}
        </div>
    );
};

// ── 도넛 전용 툴팁 (호버 시 이름 + 퍼센트, 커서 위치에 표시) ──
const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0];
    const color = d.payload?.color || '#6366f1';
    return (
        <div style={{
            background: 'rgba(15, 23, 42, 0.97)',
            backdropFilter: 'blur(20px)',
            border: `2px solid ${color}`,
            borderRadius: '14px',
            padding: '14px 20px',
            color: '#fff',
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}33`,
            textAlign: 'center' as const,
            minWidth: '130px',
            pointerEvents: 'none' as const,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88` }} />
                <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>{d.name}</span>
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>
                {d.payload?.percent ? `${(d.payload.percent * 100).toFixed(1)}%` : ''}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                {d.value?.toLocaleString()}건
            </div>
        </div>
    );
};

// ── 커스텀 범례 (이름만 깔끔하게 표시) ──
const CustomLegend = ({ payload }: any) => {
    if (!payload) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid rgba(99,102,241,0.1)' }}>
            {payload.map((entry: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span>{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

// ── 분석 인사이트 자동 생성 ──
function generateInsights(data: AnalyticsData) {
    const periodLabel = data.period === 7 ? '최근 7일' : data.period === 30 ? '최근 30일' : '최근 90일';

    // 1. 신규 vs 재방문
    const newPct = data.totalRecords > 0 ? Math.round((data.newVsReturning[0]?.value || 0) / data.totalRecords * 100) : 0;
    const retPct = 100 - newPct;
    const newVsRetAnalysis = retPct >= 20
        ? `${periodLabel} 기준 재방문 고객이 ${retPct}%로, 단골 확보가 양호합니다. 기존 고객의 재구매 패턴이 형성되고 있습니다.`
        : `${periodLabel} 기준 신규 고객이 ${newPct}%로 대부분입니다. 아직 단골 고객 비율이 낮아 재방문 유도 전략이 필요합니다.`;
    const newVsRetStrategy = retPct >= 20
        ? `재방문 고객에게 VIP 할인 또는 전용 상품을 제안하여 충성도를 강화하세요. 신규 유입 채널도 병행 확대하세요.`
        : `첫 여행 후 3개월 내 리마인드 메시지를 보내고, 재방문 고객 전용 혜택(할인 쿠폰 등)을 도입하세요.`;

    // 2. 유입 경로
    const topSource = data.inquirySource[0];
    const topSourcePct = data.totalSourceInquiries > 0 && topSource ? Math.round(topSource.value / data.totalSourceInquiries * 100) : 0;
    const sourceAnalysis = topSource
        ? `가장 큰 유입 채널은 "${topSource.name}"으로 전체의 ${topSourcePct}%를 차지합니다. ${data.inquirySource.length > 3 ? '유입 채널이 다양하게 분산되어 있습니다.' : '주요 채널에 집중되어 있어 채널 다각화가 필요합니다.'}`
        : '유입 경로 데이터가 부족합니다.';
    const sourceStrategy = topSourcePct > 60
        ? `"${topSource?.name}" 채널 의존도가 높습니다. 네이버/인스타 등 추가 채널을 개발하여 리스크를 분산하세요.`
        : `상위 채널의 ROI를 분석하고 효율 높은 채널에 광고비를 집중 투자하여 전환율을 극대화하세요.`;

    // 3. 인기 여행지
    const topDest = data.topDestinations[0];
    const top3Names = data.topDestinations.slice(0, 3).map(d => d.name).join(', ');
    const destAnalysis = topDest
        ? `가장 인기 있는 여행지는 "${topDest.name}"이며, TOP 3는 ${top3Names}입니다. 이 지역들에 대한 상품 구성을 강화하세요.`
        : '방문 국가 데이터가 부족합니다.';
    const destStrategy = topDest
        ? `인기 여행지 상위 3곳의 전용 패키지를 띠배너와 SNS에 집중 노출하고, 비인기 지역은 특가 프로모션으로 수요를 발굴하세요.`
        : '목적지 데이터를 적극적으로 수집하세요.';

    // 4. 전환율
    const totalInq = data.conversionData[0]?.value || 0;
    const converted = data.conversionData[1]?.value || 0;
    const cvr = data.conversionRate;
    const convAnalysis = `${periodLabel} 동안 총 ${totalInq}건의 문의 중 ${converted}건이 예약 전환되어 전환율은 ${cvr}%입니다. ${cvr >= 25 ? '업계 평균 이상의 좋은 성과입니다.' : '전환율 개선 여지가 있습니다.'}`;
    const convStrategy = cvr >= 25
        ? `현재 전환율이 양호합니다. 상담 품질을 유지하면서, 미전환 고객에게 48시간 내 팔로업 메시지를 보내 추가 전환을 노리세요.`
        : `전환율이 낮습니다. 첫 문의 후 24시간 내 빠른 응답과, 가격 비교표 제공으로 결정을 도와주세요. 리마인드 설정을 적극 활용하세요.`;

    // 5. 전환 추이
    const trend = data.conversionTrend;
    const lastTwo = trend.slice(-2);
    const trendUp = lastTwo.length === 2 && lastTwo[1].전환 > lastTwo[0].전환;
    const trendAnalysis = trend.length > 1
        ? `최근 전환 추이는 ${trendUp ? '상승세' : '하락세 또는 보합'}입니다. ${trendUp ? '마케팅과 상담 품질의 시너지가 나타나고 있습니다.' : '문의는 들어오지만 전환으로 이어지지 않는 구간이 있습니다.'}`
        : '추이 분석을 위한 데이터가 부족합니다.';
    const trendStrategy = trendUp
        ? `상승 모멘텀을 유지하기 위해 인기 상품의 재고를 확보하고, 성수기 프로모션을 사전 기획하세요.`
        : `전환이 떨어지는 시점의 문의 내용을 분석하여 이탈 원인을 파악하세요. 가격, 일정, 응답 속도 중 병목을 찾아야 합니다.`;

    // 6. 리드타임
    const leadMax = data.leadTimeData.reduce((a, b) => a.value > b.value ? a : b, { name: '', value: 0 });
    const leadAnalysis = leadMax.value > 0
        ? `고객들은 주로 출발 "${leadMax.name}" 전에 예약합니다. ${leadMax.name.includes('61') || leadMax.name.includes('31') ? '여유 있게 예약하는 패턴으로, 얼리버드 프로모션이 효과적일 수 있습니다.' : '출발 임박 예약이 많아, 긴급 상품 준비가 필요합니다.'}`
        : '리드타임 데이터가 부족합니다.';
    const leadStrategy = leadMax.name.includes('61') || leadMax.name.includes('31')
        ? `60일 이상 전 예약 고객에게 얼리버드 할인을 제공하고, 출발 30일 전에 잔금 리마인드를 자동 발송하세요.`
        : `출발 임박 예약이 많으므로, 직전 특가와 즉시 출발 상품을 별도 카테고리로 운영하세요.`;

    return [
        { analysis: newVsRetAnalysis, strategy: newVsRetStrategy },
        { analysis: sourceAnalysis, strategy: sourceStrategy },
        { analysis: destAnalysis, strategy: destStrategy },
        { analysis: convAnalysis, strategy: convStrategy },
        { analysis: trendAnalysis, strategy: trendStrategy },
        { analysis: leadAnalysis, strategy: leadStrategy },
    ];
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);
    const [destMode, setDestMode] = useState<'inquiries' | 'bookings'>('inquiries');
    const [trendSource, setTrendSource] = useState('전체');
    const [convSource, setConvSource] = useState('전체');

    const fetchAnalytics = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/analytics?period=${p}`);
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch (e) {
            console.error('[Analytics] Fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAnalytics(period); }, [period, fetchAnalytics]);

    if (loading && !data) {
        return (
            <div className="analytics-loading">
                <div className="analytics-loading-spinner" />
                <p>데이터를 분석하고 있습니다...</p>
            </div>
        );
    }

    if (!data) return <div className="analytics-loading"><p>데이터를 불러올 수 없습니다.</p></div>;

    const insights = generateInsights(data);
    const leadTimeColors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

    return (
        <div className="analytics-container">
            {/* ──── Header ──── */}
            <div className="analytics-header">
                <div className="analytics-header-left">
                    <h1 className="analytics-title"><BarChart3 size={28} strokeWidth={2.5} />데이터 분석</h1>
                    <p className="analytics-subtitle">고객 유입부터 전환까지, 비즈니스 핵심 지표를 한눈에 파악하세요.</p>
                </div>
                <div className="analytics-header-right">
                    <div className="period-filter-group">
                        {PERIOD_OPTIONS.map(opt => (
                            <button key={opt.value} className={`period-btn ${period === opt.value ? 'active' : ''}`} onClick={() => setPeriod(opt.value)} disabled={loading}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button className="analytics-refresh-btn" onClick={() => fetchAnalytics(period)} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>



            {/* ═══════════ 상단: 도넛 차트 (2열) ═══════════ */}
            <div className="analytics-row-2col">
                {/* 1. 신규 vs 재방문 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}><Users size={20} /></div>
                        <div><h3>신규 vs 재방문</h3><p>우리 단골은 얼마나 되나요?</p></div>
                    </div>
                    <div className="chart-area-large">
                        {data.newVsReturning.every(d => d.value === 0) ? (
                            <div className="chart-empty">데이터가 없습니다</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={data.newVsReturning} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" strokeWidth={0}
                                        label={renderInnerPercent} labelLine={false}>
                                        {data.newVsReturning.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
                                    <Legend content={<CustomLegend />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[0].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[0].strategy}</p>
                        </div>
                    </div>
                </div>

                {/* 2. 유입 경로 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}><ArrowRightLeft size={20} /></div>
                        <div><h3>유입 경로</h3><p>어떤 채널이 제일 잘 먹히나?</p></div>
                    </div>
                    <div className="chart-area-large">
                        {data.inquirySource.length === 0 ? (
                            <div className="chart-empty">데이터가 없습니다</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={data.inquirySource} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value" strokeWidth={0}
                                        label={renderInnerPercent} labelLine={false}>
                                        {data.inquirySource.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
                                    <Legend content={<CustomLegend showRate={true} />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[1].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[1].strategy}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="analytics-row-2col">
                {/* 3. 인기 여행지 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Globe size={20} /></div>
                        <div style={{ flex: 1 }}><h3>인기 여행지 TOP 5</h3><p>{destMode === 'inquiries' ? '고객이 문의한 국가 TOP 5' : '실제 예약이 확정된 국가 TOP 5'}</p></div>
                        <div className="toggle-group">
                            <button className={`toggle-btn ${destMode === 'inquiries' ? 'active' : ''}`} onClick={() => setDestMode('inquiries')}>문의순</button>
                            <button className={`toggle-btn ${destMode === 'bookings' ? 'active' : ''}`} onClick={() => setDestMode('bookings')}>확정순</button>
                        </div>
                    </div>
                    <div className="chart-area-large">
                        {data.topDestinations.length === 0 ? (
                            <div className="chart-empty">데이터가 없습니다</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={data.topDestinations} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey={destMode} strokeWidth={0}
                                        label={renderInnerPercent} labelLine={false}>
                                        {data.topDestinations.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
                                    <Legend content={<CustomLegend />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[2].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[2].strategy}</p>
                        </div>
                    </div>
                </div>

                {/* 4. 문의 대비 전환율 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}><TrendingUp size={20} /></div>
                        <div style={{ flex: 1 }}><h3>문의 → 전환율</h3><p>{convSource === '전체' ? `문의 ${data.conversionData[0]?.value || 0}건 중 ${data.conversionData[1]?.value || 0}건 전환` : `"${convSource}" 채널 성과`}</p></div>
                        <select 
                            className="source-select" 
                            style={{ marginRight: '12px' }}
                            value={convSource} 
                            onChange={(e) => setConvSource(e.target.value)}
                        >
                            <option value="전체">전체 채널</option>
                            {data.inquirySource.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                        <div className="kpi-cvr-badge">
                            <span className="kpi-label">{convSource === '전체' ? '전체' : '채널'} 전환율</span>
                            <span className="kpi-value">
                                {convSource === '전체' 
                                    ? data.conversionRate 
                                    : (data.inquirySource.find(s => s.name === convSource)?.conversionRate || 0)}%
                            </span>
                        </div>
                    </div>
                    <div className="chart-area-large">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart 
                                data={(() => {
                                    if (convSource === '전체') return data.conversionData;
                                    const s = data.inquirySource.find(src => src.name === convSource);
                                    if (!s) return [];
                                    return [
                                        { name: '총 문의', value: s.value, color: '#6366f1' },
                                        { name: '예약 전환', value: s.converted, color: '#22d3ee' },
                                        { name: '상담중/미전환', value: s.value - s.converted, color: '#334155' },
                                    ];
                                })()} 
                                layout="vertical" 
                                margin={{ top: 10, right: 40, left: 20, bottom: 10 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={false} isAnimationActive={false} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={34} activeBar={{ filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}>
                                    {data.conversionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[3].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[3].strategy}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="analytics-row-2col">
                {/* 5. 전환 추이 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}><TrendingUp size={20} /></div>
                        <div style={{ flex: 1 }}><h3>전환 추이</h3><p>{trendSource === '전체' ? '문의와 전환 건수의 시간별 흐름' : `"${trendSource}" 채널의 성과 추이`}</p></div>
                        <select 
                            className="source-select" 
                            value={trendSource} 
                            onChange={(e) => setTrendSource(e.target.value)}
                        >
                            <option value="전체">전체 채널</option>
                            {data.inquirySource.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="chart-area-large">
                        {(!data.conversionTrend || data.conversionTrend.length === 0) ? (
                            <div className="chart-empty">데이터가 없습니다</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart 
                                    data={trendSource === '전체' ? data.conversionTrend : (data.sourceTrends[trendSource] || [])} 
                                    margin={{ top: 10, right: 30, left: -5, bottom: 10 }}
                                >
                                    <defs>
                                        <linearGradient id="gradInq" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="gradCvt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                                    <Legend content={<CustomLegend />} />
                                    <Area type="monotone" dataKey="문의" fill="url(#gradInq)" stroke="transparent" />
                                    <Area type="monotone" dataKey="전환" fill="url(#gradCvt)" stroke="transparent" />
                                    <Line type="monotone" dataKey="문의" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#1e1b4b' }} activeDot={{ r: 7 }} />
                                    <Line type="monotone" dataKey="전환" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 5, fill: '#22d3ee', strokeWidth: 2, stroke: '#0c2433' }} activeDot={{ r: 7 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[4].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[4].strategy}</p>
                        </div>
                    </div>
                </div>

                {/* 6. 예약 리드타임 */}
                <div className="analytics-card-large">
                    <div className="card-header">
                        <div className="card-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Calendar size={20} /></div>
                        <div><h3>예약 리드타임</h3><p>출발 며칠 전에 예약하나요?</p></div>
                    </div>
                    <div className="chart-area-large">
                        {data.leadTimeData.every(d => d.value === 0) ? (
                            <div className="chart-empty">데이터가 없습니다</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.leadTimeData} layout="vertical" margin={{ top: 10, right: 40, left: 20, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={false} isAnimationActive={false} />
                                    <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={28} activeBar={{ filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}>
                                        {data.leadTimeData.map((_, i) => <Cell key={i} fill={leadTimeColors[i % leadTimeColors.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="card-insight">
                        <div className="insight-box analysis-box">
                            <div className="insight-box-header"><FileText size={14} /><span>분석 요약</span></div>
                            <p>{insights[5].analysis}</p>
                        </div>
                        <div className="insight-box strategy-box">
                            <div className="insight-box-header"><Lightbulb size={14} /><span>전략 제안</span></div>
                            <p>{insights[5].strategy}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
