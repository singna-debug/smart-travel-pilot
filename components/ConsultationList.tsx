'use client';

import React, { useState, useEffect } from 'react';
import { ConsultationData } from '@/types';
import { EditableField, InfoCell, TimelineCell } from './EditableComponents';
import { Pencil, MapPin, Calendar, Users } from 'lucide-react';

interface ConsultationListProps {
    title: string;
    data: ConsultationData[];
    emptyMessage?: string;
    onUpdate?: () => void;
}

export default function ConsultationList({ title, data, emptyMessage = "해당하는 내역이 없습니다.", onUpdate }: ConsultationListProps) {
    const [localData, setLocalData] = useState<ConsultationData[]>(data);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    // Edit states
    const [editingCustomerChatId, setEditingCustomerChatId] = useState<string | null>(null);
    const [editingTripChatId, setEditingTripChatId] = useState<string | null>(null);
    const [customerHistoryByPhone, setCustomerHistoryByPhone] = useState<Record<string, any[]>>({});
    const [historyLoading, setHistoryLoading] = useState<string | null>(null);

    useEffect(() => {
        setLocalData(data);
    }, [data]);

    const fetchCustomerHistory = async (chatId: string, phone: string) => {
        if (!phone || phone === '미정' || customerHistoryByPhone[phone]) return;
        setHistoryLoading(chatId);
        try {
            const res = await fetch(`/api/consultations/history?phone=${encodeURIComponent(phone)}`);
            const d = await res.json();
            if (d.success) {
                setCustomerHistoryByPhone(prev => ({ ...prev, [phone]: d.data }));
            }
        } catch (err) {
            console.error('History fetch error:', err);
        } finally {
            setHistoryLoading(null);
        }
    };

    const handleFieldUpdate = async (chatId: string, field: string, value: string) => {
        const index = Number(chatId);
        const item = localData[index];
        if (!item || item.sheetRowIndex === undefined) {
            alert('구글 시트 연동 정보가 아직 확인되지 않았습니다.');
            return;
        }

        const originalData = [...localData];
        const newData = [...localData];
        const copy = JSON.parse(JSON.stringify(item));

        const updateMapping: Record<string, string[]> = {
            visitorName: ['customer', 'name'],
            visitorPhone: ['customer', 'phone'],
            travelersCount: ['trip', 'travelers_count'],
            recurringCustomer: ['automation', 'recurringCustomer'],
            inquirySource: ['automation', 'inquirySource'],
            destination: ['trip', 'destination'],
            departureDate: ['trip', 'departure_date'],
            returnDate: ['trip', 'return_date'],
            duration: ['trip', 'duration'],
            productName: ['trip', 'product_name'],
            productUrl: ['trip', 'url'],
            summary: ['summary'],
            status: ['automation', 'status'],
            nextFollowup: ['automation', 'next_followup'],
            confirmedProduct: ['automation', 'confirmed_product'],
            confirmedDate: ['automation', 'confirmed_date'],
            prepaidDate: ['automation', 'prepaid_date'],
            noticeDate: ['automation', 'notice_date'],
            balanceDate: ['automation', 'balance_date'],
            confirmationSent: ['automation', 'confirmation_sent'],
            departureNotice: ['automation', 'departure_notice'],
            phoneNotice: ['automation', 'phone_notice'],
            happyCall: ['automation', 'happy_call'],
        };

        if (updateMapping[field]) {
            const path = updateMapping[field];
            if (path.length === 1) copy[path[0]] = value;
            else if (path.length === 2) copy[path[0]][path[1]] = value;

            // 상태 변경 시 관련 예약정보 UI에서도 즉시 초기화 (상담중/견적제공/취소 등)
            if (field === 'status' && ['상담중', '견적제공', '취소', '취소/보류', '상담완료'].includes(value)) {
                if (copy.automation) {
                    copy.automation.confirmed_product = '';
                    copy.automation.confirmed_date = '';
                    copy.automation.prepaid_date = '';
                    // 타임라인 정보들까지 일괄 초기화
                    copy.automation.notice_date = '';
                    copy.automation.balance_date = '';
                    copy.automation.confirmation_sent = '';
                    copy.automation.departure_notice = '';
                    copy.automation.phone_notice = '';
                    copy.automation.happy_call = '';
                }
            }

            newData[index] = copy;
            setLocalData(newData);
        }

        try {
            const response = await fetch('/api/consultations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: item.sheetRowIndex,
                    sheetName: item.sheetName,
                    sheetGid: item.sheetGid,
                    field,
                    value,
                }),
            });
            const apiResult = await response.json();
            if (!response.ok || !apiResult.success) {
                throw new Error(apiResult.error || '업데이트 실패');
            }
            
            // 상위 컴포넌트(대시보드)에 정보 갱신 알림
            if (onUpdate) onUpdate();
        } catch (error: any) {
            setLocalData(originalData);
            alert(`업데이트 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    if (!data || data.length === 0) {
        return (
            <div className="dashboard-list-section empty-state">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const toggleExpand = (index: number) => {
        if (expandedIndex !== index) {
            setExpandedIndex(index);
            const item = localData[index];
            if (item && item.customer.phone && item.customer.phone !== '미정') {
                fetchCustomerHistory(String(index), item.customer.phone);
            }
        } else {
            setExpandedIndex(null);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const isDateToday = (dateStr?: string) => dateStr && dateStr.startsWith(today);
    const isDatePast = (dateStr?: string) => {
        if (!dateStr) return false;
        try { return new Date(dateStr) < new Date(today); } catch { return false; }
    };

    return (
        <div className="dashboard-list-section">
            <div className="dashboard-list-header">
                <h3 className="dashboard-list-title">
                    {title} <span className="list-count">{localData.length}건</span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>클릭하여 상세보기</span>
            </div>
            <div className="consultation-table-wrapper">
                <table className="consultation-table">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}></th>
                            <th style={{ width: '12%' }}>고객명</th>
                            <th style={{ width: '13%' }}>연락처</th>
                            <th style={{ width: '22%' }}>여행지 / 상품</th>
                            <th style={{ width: '20%' }}>상담요약</th>
                            <th style={{ width: '10%' }}>상태</th>
                            <th style={{ width: '19%' }}>비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        {localData.map((item, index) => {
                            const isExpanded = expandedIndex === index;
                            const isTodayFollowUp = isDateToday(item.automation.next_followup);
                            const strIndex = String(index);

                            return (
                                <React.Fragment key={`row-${index}`}>
                                    <tr
                                        onClick={() => toggleExpand(index)}
                                        className={`expandable-row ${isExpanded ? 'expanded' : ''}`}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span className={`expand-arrow ${isExpanded ? 'open' : ''}`}>▶</span>
                                        </td>
                                        <td>
                                            <div className="cell-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {item.customer.name === '미정' && item.source === '카카오톡' ? '[K]미정' : item.customer.name}
                                                {item.source === '카카오톡' && (
                                                    <span style={{
                                                        backgroundColor: '#FEE500', color: '#000000',
                                                        fontSize: '0.65rem', padding: '2px 6px',
                                                        borderRadius: '4px', fontWeight: '600',
                                                        marginLeft: '4px'
                                                    }}>K</span>
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
                                                ${item.automation.status === '선금완료' ? 'prepaid' : ''}
                                                ${item.automation.status === '잔금완료' ? 'paid' : ''}
                                                ${item.automation.status === '여행완료' ? 'travel-completed' : ''}
                                                ${['상담중', '견적제공'].includes(item.automation.status) ? 'consulting' : ''}
                                                ${['취소', '취소/보류'].includes(item.automation.status) ? 'canceled' : ''}
                                                ${['상담완료'].includes(item.automation.status) ? 'completed' : ''}
                                                ${!['예약확정', '선금완료', '잔금완료', '여행완료', '상담중', '견적제공', '취소', '취소/보류', '상담완료'].includes(item.automation.status) ? 'default' : ''}
                                            `}>
                                                {item.automation.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="remark-text" style={{ fontSize: '0.75rem' }}>
                                                {item.automation.next_followup && (
                                                    <div style={isTodayFollowUp ? { color: '#f59e0b', fontWeight: 'bold' } : {}}>
                                                        팔로업: {item.automation.next_followup}
                                                    </div>
                                                )}
                                                {item.automation.status !== '상담중' && item.automation.status !== '견적제공' && (
                                                    <>
                                                        {item.automation.prepaid_date && (
                                                            <div style={isDateToday(item.automation.prepaid_date) ? { color: '#ef4444', fontWeight: 'bold' } : {}}>
                                                                선금일: {item.automation.prepaid_date}
                                                            </div>
                                                        )}
                                                        {item.automation.notice_date && (
                                                            <div style={isDateToday(item.automation.notice_date) ? { color: '#10b981', fontWeight: 'bold' } : {}}>
                                                                안내(4주): {item.automation.notice_date}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Edit Detail Panel matching ChatsPage */}
                                    {isExpanded && (
                                        <tr key={`detail-${index}`} className="detail-panel-row">
                                            <td colSpan={7} style={{ padding: 0 }}>
                                                <div style={{
                                                    padding: '20px 24px',
                                                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(139, 92, 246, 0.03))',
                                                    borderBottom: '2px solid #3b82f6',
                                                    borderLeft: '3px solid #3b82f6',
                                                    animation: 'fadeSlideDown 0.2s ease-out',
                                                    boxSizing: 'border-box'
                                                }}>
                                                    {/* Row 1: Customer + Trip Info */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                        {/* Customer Info Card & History */}
                                                        <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151', display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                                                                <h4 style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 700, margin: 0 }}>고객 정보</h4>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setEditingCustomerChatId(editingCustomerChatId === strIndex ? null : strIndex); }}
                                                                    style={{ background: editingCustomerChatId === strIndex ? '#10b98120' : 'transparent', color: editingCustomerChatId === strIndex ? '#34d399' : '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    {editingCustomerChatId === strIndex ? '완료' : <><Pencil size={12} /> 편집</>}
                                                                </button>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                                                <EditableField 
                                                                    label="고객명" 
                                                                    value={item.customer.name} 
                                                                    field="visitorName" 
                                                                    chatId={strIndex} 
                                                                    onSave={handleFieldUpdate} 
                                                                    forceEditMode={editingCustomerChatId === strIndex} 
                                                                    displayValue={item.customer.name || ((!item.source || item.source === '카카오톡') ? '[K]미정' : '(이름 미정)')}
                                                                />
                                                                <EditableField label="연락처" value={item.customer.phone} field="visitorPhone" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingCustomerChatId === strIndex} />
                                                                <EditableField label="총인원" value={String(item.trip.travelers_count || '')} field="travelersCount" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingCustomerChatId === strIndex} />
                                                                <EditableField label="재방문여부" value={item.automation.recurringCustomer || ''} field="recurringCustomer" chatId={strIndex} onSave={handleFieldUpdate} options={['신규고객', '재방문', '장기미방문', '정보없음']} forceEditMode={editingCustomerChatId === strIndex} />
                                                                 <EditableField 
                                                                    label="유입경로" 
                                                                    value={item.automation.inquirySource || ''} 
                                                                    field="inquirySource" 
                                                                    chatId={strIndex} 
                                                                    onSave={handleFieldUpdate} 
                                                                    options={['네이버 블로그', '카카오톡 채널', '인스타그램 및 페이스북', '당근마켓', '닷컴', '지인소개', '기존고객', '전화문의', '기타']} 
                                                                    forceEditMode={editingCustomerChatId === strIndex} 
                                                                />
                                                                <InfoCell label="등록방식" value={item.source || '-'} highlight={item.source === '카카오톡' ? '#fbbf24' : '#a78bfa'} />
                                                            </div>

                                                        </div>

                                                        {/* Trip Info Card */}
                                                        <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                                                                <h4 style={{ color: '#34d399', fontSize: '13px', fontWeight: 700, margin: 0 }}>여행 정보</h4>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setEditingTripChatId(editingTripChatId === strIndex ? null : strIndex); }}
                                                                    style={{ background: editingTripChatId === strIndex ? '#10b98120' : 'transparent', color: editingTripChatId === strIndex ? '#34d399' : '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    {editingTripChatId === strIndex ? '완료' : <><Pencil size={12} /> 편집</>}
                                                                </button>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                                                <EditableField label="목적지" value={item.trip.destination || ''} field="destination" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === strIndex} />
                                                                <EditableField label="출발일" value={item.trip.departure_date || ''} field="departureDate" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === strIndex} />
                                                                <EditableField label="귀국일" value={item.trip.return_date || ''} field="returnDate" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === strIndex} />
                                                                <EditableField label="기간" value={item.trip.duration || ''} field="duration" chatId={strIndex} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === strIndex} />
                                                            </div>
                                                            {/* 상품 목록 (단일/비교분석 공통) */}
                                                            {(() => {
                                                                const robustSplit = (str: string) => {
                                                                    if (!str) return [];
                                                                    const s = str.trim();
                                                                    // '1.상품...2.상품...' 형태(공백 없음) or '1. 상품...' 형태 처리
                                                                    if (/\d+\./.test(s)) {
                                                                        const parts = s.split(/\s*(?=\d+\.)/).map(v => v.trim()).filter(Boolean);
                                                                        if (parts.length > 1) return parts;
                                                                    }
                                                                    return s.split(/\s*,\s*|\s*\n\s*|\s*\|\s*/).map(v => v.trim()).filter(Boolean);
                                                                };
                                                                const names = robustSplit(item.trip.product_name || '');
                                                                const urls = robustSplit(item.trip.url || '');
                                                                const maxLen = Math.max(names.length, urls.length, 1);
                                                                 const isMultiple = (item.trip.product_name || '').includes(',') || (item.trip.url || '').includes(',') || maxLen > 1;

                                                                return (
                                                                    <div style={{ marginTop: '10px' }}>
                                                                        <div style={{ fontSize: '11px', color: isMultiple ? '#f59e0b' : '#34d399', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                                                                            {isMultiple ? `비교 상품 (${maxLen}개)` : `상담 상품`}
                                                                        </div>
                                                                        
                                                                        {/* 편집 모드 */}
                                                                        {(editingTripChatId === strIndex) ? (
                                                                            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px', padding: '12px', background: '#111827', borderRadius: '8px', border: '1px dashed #374151' }}>
                                                                                <EditableField 
                                                                                    label={isMultiple ? "전체 상품명 (콤마/줄바꿈 구분)" : "상품명"} 
                                                                                    value={item.trip.product_name || ''} 
                                                                                    field="productName" 
                                                                                    chatId={strIndex} 
                                                                                    onSave={handleFieldUpdate} 
                                                                                    wide 
                                                                                    forceEditMode={true} 
                                                                                />
                                                                                <EditableField 
                                                                                    label={isMultiple ? "전체 상품 URL (콤마/줄바꿈 구분)" : "상품 URL"} 
                                                                                    value={item.trip.url || ''} 
                                                                                    field="productUrl" 
                                                                                    chatId={strIndex} 
                                                                                    onSave={handleFieldUpdate} 
                                                                                    wide 
                                                                                    forceEditMode={true}
                                                                                    displayValue={(item.trip.url || '') ? <span style={{ color: '#38bdf8' }}>🔗 링크 {isMultiple ? '복수 ' : ''}등록됨 (수정)</span> : undefined}
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                                {Array.from({ length: maxLen }).map((_, i) => {
                                                                                    const rawName = names[i] || '';
                                                                                    const cleanName = rawName.replace(/^\d+\.?\s*/, '').replace(/^상품\d+:\s*/, '').trim();
                                                                                    const name = cleanName ? `상품${i + 1}: ${cleanName}` : (isMultiple ? `상품 ${i + 1}` : '상품명 미상');
                                                                                    const url = urls[i] || '';
                                                                                    return (
                                                                                        <div key={i} style={{
                                                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                                                            padding: '8px 10px', background: '#111827',
                                                                                            borderRadius: '6px', borderLeft: `3px solid ${isMultiple ? ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'][i % 5] : '#3b82f6'}`,
                                                                                        }}>
                                                                                            {isMultiple && <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, minWidth: '20px' }}>{i + 1}</span>}
                                                                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                                                {url ? (
                                                                        (() => {
                                                                            let cleanUrl = url.trim().replace(/^\d+\.?\s*/, '');
                                                                            // https:/ 시작하면 https://로 보정
                                                                            if (cleanUrl.startsWith('https:/') && !cleanUrl.startsWith('https://')) {
                                                                                cleanUrl = cleanUrl.replace('https:/', 'https://');
                                                                            } else if (cleanUrl.startsWith('http:/') && !cleanUrl.startsWith('http://')) {
                                                                                cleanUrl = cleanUrl.replace('http:/', 'http://');
                                                                            }
                                                                            if (cleanUrl && !cleanUrl.startsWith('http')) {
                                                                                cleanUrl = 'https://' + cleanUrl;
                                                                            }
                                                                            return (
                                                                                <a href={cleanUrl} target="_blank" rel="noopener noreferrer"
                                                                                    style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'underline' }}>
                                                                                    {name.trim()}
                                                                                </a>
                                                                            );
                                                                        })()
                                                                    ) : (
                                                                                                    <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                                        {name.trim()}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 방문 이력 (재방문 고객용) */}
                                                    {(() => {
                                                        const history = customerHistoryByPhone[item.customer.phone];
                                                        const isLoadingHistory = historyLoading === strIndex;
                                                        
                                                        if (isLoadingHistory) {
                                                            return (
                                                                <div style={{ marginBottom: '16px', padding: '16px', background: '#1f2937', borderRadius: '10px', border: '1px solid #374151' }}>
                                                                    <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600 }}>이전 방문 이력을 불러오는 중입니다...</span>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        if (!history || history.length < 2) return null;

                                                        const previousVisitsMap = new Map();
                                                        history.filter((h: any) =>
                                                            h.sheetName !== item.sheetName || h.consultationDate !== item.timestamp
                                                        ).forEach((h: any) => {
                                                            const key = `${h.productName}-${h.productUrl || h.sheetName}`;
                                                            if (!previousVisitsMap.has(key)) {
                                                                previousVisitsMap.set(key, h);
                                                            }
                                                        });
                                                        const previousVisits = Array.from(previousVisitsMap.values());

                                                        if (previousVisits.length === 0) return null;

                                                        return (
                                                            <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151', marginBottom: '16px' }}>
                                                                <h4 style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    이전 문의 및 방문 이력
                                                                    <span style={{ backgroundColor: '#f59e0b20', color: '#f59e0b', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                                                        {previousVisits.length}건
                                                                    </span>
                                                                </h4>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                                                                    {previousVisits.map((visit: any, idx: number) => {
                                                                        const isConfirmed = ['예약확정', '결제완료', '전액결제', '완납', '여행완료', '출발확정'].includes(visit.status);
                                                                        const borderColor = isConfirmed ? '#10b981' : '#6b7280';
                                                                        const badgeBg = isConfirmed ? '#10b98120' : '#374151';
                                                                        const badgeColor = isConfirmed ? '#34d399' : '#9ca3af';
                                                                        const displayDate = isConfirmed ? visit.departureDate : (visit.consultationDate ? visit.consultationDate.split(' ')[0] : '-');
                                                                        const dateLabel = isConfirmed ? '출발일:' : '문의일:';

                                                                        return (
                                                                            <div key={idx} style={{
                                                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                                                padding: '12px', background: '#111827',
                                                                                borderRadius: '8px', borderLeft: `4px solid ${borderColor}`,
                                                                                border: '1px solid #1f2937'
                                                                            }}>
                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: 600, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        {visit.productName || '상품 미정'}
                                                                                    </div>
                                                                                    <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                        {displayDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: isConfirmed ? '#34d399' : '#9ca3af' }}><Calendar size={12} /> {dateLabel} {displayDate}</span>}
                                                                                        {visit.destination && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {visit.destination}</span>}
                                                                                        {visit.status && (
                                                                                            <span style={{
                                                                                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                                                                                background: badgeBg,
                                                                                                color: badgeColor,
                                                                                            }}>
                                                                                                {visit.status}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {visit.productUrl && (
                                                                                    <a href={visit.productUrl} target="_blank" rel="noopener noreferrer"
                                                                                        title="상품 페이지 열기"
                                                                                        style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 600, padding: '6px 8px', background: '#38bdf810', borderRadius: '6px', border: '1px solid #38bdf830' }}>
                                                                                        열기 →
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Row 2: Summary */}
                                                    <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151', marginBottom: '16px' }}>
                                                        <h4 style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>상담 요약</h4>
                                                        <EditableField 
                                                            label="" 
                                                            value={item.summary || ''} 
                                                            field="summary" 
                                                            chatId={strIndex} 
                                                            onSave={handleFieldUpdate} 
                                                            allowClickToEdit={true}
                                                            multiline={true}
                                                            displayValue={
                                                                <div style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.7', whiteSpace: 'pre-wrap', background: '#111827', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24', width: '100%', minHeight: '40px' }}>
                                                                    {item.summary || <span style={{ color: '#6b7280' }}>여기를 클릭하여 요약을 작성하거나 수정하세요.</span>}
                                                                </div>
                                                            }
                                                        />
                                                    </div>

                                                    {/* Row 3: Automation Timeline */}
                                                    <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151' }}>
                                                        <h4 style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>진행 현황</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                            <TimelineCell label="팔로업일" date={item.automation.next_followup || ''} today={today} field="nextFollowup" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="예약확정일" date={item.automation.confirmed_date || ''} today={today} field="confirmedDate" chatId={strIndex} />
                                                            <TimelineCell label="선금일" date={item.automation.prepaid_date || ''} today={today} field="prepaidDate" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="출발전안내" date={item.automation.notice_date || ''} today={today} field="noticeDate" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="잔금일" date={item.automation.balance_date || ''} today={today} field="balanceDate" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="확정서발송" date={item.automation.confirmation_sent || ''} today={today} field="confirmationSent" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="출발안내" date={item.automation.departure_notice || ''} today={today} field="departureNotice" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="전화안내" date={item.automation.phone_notice || ''} today={today} field="phoneNotice" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            <TimelineCell label="해피콜" date={item.automation.happy_call || ''} today={today} field="happyCall" chatId={strIndex} onCheck={handleFieldUpdate} />
                                                            {item.automation.confirmed_product && (
                                                                <div style={{ gridColumn: 'span 1', padding: '8px', background: '#111827', borderRadius: '6px', fontSize: '11px' }}>
                                                                    <div style={{ color: '#6b7280', marginBottom: '4px' }}>확정상품</div>
                                                                    <a href={item.automation.confirmed_product} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: '11px', textDecoration: 'none' }}>열기 →</a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: '#6b7280' }}>
                                                        <span>📋 상담일시: {item.timestamp || '-'}</span>
                                                        {item.visitor_id && <span>🆔 Visitor: {item.visitor_id.substring(0, 12)}...</span>}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

