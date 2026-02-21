'use client';

import { ConsultationData } from '@/types';

interface ConsultationListProps {
    title: string;
    data: ConsultationData[];
    emptyMessage?: string;
}

export default function ConsultationList({ title, data, emptyMessage = "해당하는 내역이 없습니다." }: ConsultationListProps) {
    if (!data || data.length === 0) {
        return (
            <div className="dashboard-list-section empty-state">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="dashboard-list-section">
            <div className="dashboard-list-header">
                <h3 className="dashboard-list-title">
                    {title} <span className="list-count">{data.length}건</span>
                </h3>
            </div>
            <div className="consultation-table-wrapper">
                <table className="consultation-table">
                    <thead>
                        <tr>
                            <th style={{ width: '15%' }}>고객명</th>
                            <th style={{ width: '15%' }}>연락처</th>
                            <th style={{ width: '25%' }}>여행지/상품</th>
                            <th style={{ width: '20%' }}>상담요약</th>
                            <th style={{ width: '10%' }}>상태</th>
                            <th style={{ width: '15%' }}>비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => {
                            const today = new Date().toISOString().split('T')[0];
                            const isTodayFollowUp = item.automation.next_followup && item.automation.next_followup.startsWith(today);

                            return (
                                <tr key={index}>
                                    <td>
                                        <div className="cell-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {item.customer.name}
                                            {(!item.source || item.source === '카카오톡') && (
                                                <span style={{
                                                    backgroundColor: '#FEE500',
                                                    color: '#000000',
                                                    fontSize: '0.65rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: '600'
                                                }}>
                                                    K
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="cell-secondary">{item.customer.phone}</div>
                                    </td>
                                    <td>
                                        <div className="cell-primary">{item.trip.destination}</div>
                                        <div className="cell-sub" title={item.trip.product_name}>
                                            {item.trip.product_name}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="cell-primary" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                                            {item.summary || '-'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge 
                                            ${item.automation.status === '예약확정' ? 'confirmed' : ''}
                                            ${item.automation.status === '결제완료' ? 'paid' : ''}
                                            ${['상담중', '견적제공'].includes(item.automation.status) ? 'consulting' : ''}
                                            ${['취소', '취소/보류'].includes(item.automation.status) ? 'canceled' : ''}
                                            ${item.automation.status === '상담완료' ? 'completed' : ''}
                                            ${!['예약확정', '결제완료', '상담중', '견적제공', '취소', '취소/보류', '상담완료'].includes(item.automation.status) ? 'default' : ''}
                                        `}>
                                            {item.automation.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="remark-text">
                                            {item.automation.next_followup ? (
                                                <div
                                                    className="remark-followup"
                                                    style={isTodayFollowUp ? { color: '#ef4444', fontWeight: 'bold' } : {}}
                                                >
                                                    팔로업: {item.automation.next_followup}
                                                </div>
                                            ) : null}
                                            {item.automation.balance_due_date ? (
                                                <div className="remark-urgent">잔금: {item.automation.balance_due_date}</div>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
