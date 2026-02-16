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
                            <th style={{ width: '20%' }}>일정</th>
                            <th style={{ width: '10%' }}>상태</th>
                            <th style={{ width: '15%' }}>비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => (
                            <tr key={index}>
                                <td>
                                    <div className="cell-primary">{item.customer.name}</div>
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
                                    <div className="cell-primary">
                                        {item.trip.departure_date}
                                        {item.trip.return_date ? ` ~ ${item.trip.return_date.slice(5)}` : ''}
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-badge 
                                        ${item.automation.status === '예약확정' ? 'confirmed' : ''}
                                        ${item.automation.status === '결제완료' ? 'paid' : ''}
                                        ${['상담중', '견적제공'].includes(item.automation.status) ? 'consulting' : ''}
                                        ${item.automation.status === '취소' ? 'canceled' : ''}
                                        ${!['예약확정', '결제완료', '상담중', '견적제공', '취소'].includes(item.automation.status) ? 'default' : ''}
                                    `}>
                                        {item.automation.status}
                                    </span>
                                </td>
                                <td>
                                    <div className="remark-text">
                                        {item.automation.next_followup ? (
                                            <div className="remark-followup">팔로업: {item.automation.next_followup}</div>
                                        ) : null}
                                        {item.automation.balance_due_date ? (
                                            <div className="remark-urgent">잔금: {item.automation.balance_due_date}</div>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
