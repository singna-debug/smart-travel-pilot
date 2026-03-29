'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Calendar, Users, ChevronDown, Pencil } from 'lucide-react';
import { EditableField, InfoCell, TimelineCell } from '../../components/EditableComponents';

interface ChatItem {
    id: string;
    visitorName: string;
    visitorPhone: string;
    travelersCount: string;
    recurringCustomer: string;
    inquirySource: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    duration: string;
    productName: string;
    productUrl: string;
    summary: string;
    status: string;
    source: string;
    nextFollowup: string;
    confirmedProduct: string;
    confirmedDate: string;
    prepaidDate: string;
    noticeDate: string;
    balanceDate: string;
    confirmationSent: string;
    departureNotice: string;
    phoneNotice: string;
    happyCall: string;
    lastMessage: string;
    lastMessageAt: string;
    messageCount: number;
    sheetRowIndex?: number;
    sheetName?: string;
    sheetGid?: number;
}

const STATUS_OPTIONS = ['상담중', '예약확정', '선금완료', '잔금완료', '여행완료', '취소/보류', '상담완료'];

// 다크 테마 색상 (모든 상태 매핑)
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    '상담중': { bg: '#3b82f6', text: '#fff' },
    '예약확정': { bg: '#10b981', text: '#fff' },
    '선금완료': { bg: '#8b5cf6', text: '#fff' },
    '잔금완료': { bg: '#4f46e5', text: '#fff' },
    '여행완료': { bg: '#0ea5e9', text: '#fff' },
    '취소/보류': { bg: '#ef4444', text: '#fff' },
    '상담완료': { bg: '#6b7280', text: '#fff' },
};

export default function ChatsPage() {
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // 추가된 상태
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [editingCustomerChatId, setEditingCustomerChatId] = useState<string | null>(null);
    const [editingTripChatId, setEditingTripChatId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ chat: ChatItem; } | null>(null);
    const [confirmUrl, setConfirmUrl] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [customerHistoryByPhone, setCustomerHistoryByPhone] = useState<Record<string, any[]>>({});
    const [historyLoading, setHistoryLoading] = useState<string | null>(null);

    const fetchCustomerHistory = async (chatId: string, phone: string) => {
        if (!phone || phone === '미정' || customerHistoryByPhone[phone]) return;
        setHistoryLoading(chatId);
        try {
            const res = await fetch(`/api/consultations/history?phone=${encodeURIComponent(phone)}`);
            const data = await res.json();
            if (data.success) {
                setCustomerHistoryByPhone(prev => ({ ...prev, [phone]: data.data }));
            }
        } catch (err) {
            console.error('History fetch error:', err);
        } finally {
            setHistoryLoading(null);
        }
    };

    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 30000);
        return () => clearInterval(interval);
    }, [statusFilter]);

    const handleFieldUpdate = async (chatId: string, field: string, value: string) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        if (chat.sheetRowIndex === undefined) {
            alert('구글 시트 연동 정보가 아직 확인되지 않았습니다. 잠시 후 ↻새로고침을 눌러 다시 시도해주세요.');
            return;
        }

        // 날짜 자동 포맷팅 (예: 20260412 -> 2026-04-12)
        const dateFields = ['departureDate', 'returnDate', 'confirmedDate', 'prepaidDate', 'noticeDate', 'balanceDate', 'confirmationSent', 'departureNotice', 'phoneNotice', 'happyCall', 'nextFollowup'];
        let formattedValue = value;
        if (dateFields.includes(field) && formattedValue) {
            const cleanStr = formattedValue.trim();
            if (/^\d{8}(\s*\(.*\))?$/.test(cleanStr)) {
                formattedValue = cleanStr.replace(/^(\d{4})(\d{2})(\d{2})(.*)$/, '$1-$2-$3$4').trim();
            } else if (/^\d{6}(\s*\(.*\))?$/.test(cleanStr)) {
                formattedValue = cleanStr.replace(/^(\d{2})(\d{2})(\d{2})(.*)$/, '20$1-$2-$3$4').trim();
            } else if (/^\d{4}\.\d{1,2}\.\d{1,2}(\s*\(.*\))?$/.test(cleanStr)) {
                // 2026.04.12 형식 지원
                formattedValue = cleanStr.replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(.*)$/, (_, y, m, d, rest) => 
                    `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${rest}`
                ).trim();
            }
        }

        try {
            const res = await fetch('/api/consultations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: chat.sheetRowIndex,
                    sheetName: chat.sheetName,
                    field,
                    value: formattedValue
                })
            });
            const data = await res.json();
            if (data.success) {
                setChats(prev => prev.map(c => {
                    if (c.id === chatId) {
                        const updated = { ...c, [field]: formattedValue };
                        // 상태가 상담중/견적제공/취소 등으로 변경되면 모든 예약 정보 초기화
                        if (field === 'status' && ['상담중', '견적제공', '취소', '취소/보류', '상담완료'].includes(formattedValue)) {
                            updated.confirmedProduct = '';
                            updated.confirmedDate = '';
                            updated.prepaidDate = '';
                            updated.noticeDate = '';
                            updated.balanceDate = '';
                            updated.confirmationSent = '';
                            updated.departureNotice = '';
                            updated.phoneNotice = '';
                            updated.happyCall = '';
                        }
                        return updated;
                    }
                    return c;
                }));
            } else {
                alert(`수정 실패: ${data.error}`);
            }
        } catch (error) {
            console.error('Update field error:', error);
            alert('업데이트 중 오류가 발생했습니다.');
        }
    };

    const fetchChats = async (forceRefresh = false) => {
        try {
            let url = '/api/chats?limit=100';
            if (forceRefresh) {
                url += '&refresh=true';
                setLoading(true); // 수동 새로고침 시 로딩 표시
            }
            if (statusFilter) {
                url += `&status=${encodeURIComponent(statusFilter)}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setChats(data.data);
            }
        } catch (error) {
            console.error('상담 목록 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            fetchChats();
            return;
        }

        try {
            const response = await fetch(`/api/chats?search=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            if (data.success) {
                setChats(data.data);
            }
        } catch (error) {
            console.error('검색 오류:', error);
        }
    };

    const handleStatusChange = async (chat: ChatItem, newStatus: string) => {
        if (!chat.sheetRowIndex) {
            alert('시트 행 정보가 없어 상태를 변경할 수 없습니다.');
            return;
        }

        // 예약확정 선택 시 → 확정상품 URL 입력 모달 표시
        if (newStatus === '예약확정') {
            setConfirmModal({ chat });
            setConfirmUrl('');
            return;
        }

        setUpdating(chat.id);
        try {
            const response = await fetch('/api/consultations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: chat.sheetRowIndex,
                    status: newStatus,
                    sheetName: chat.sheetName,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setChats(prev => prev.map(c => {
                    if (c.id === chat.id) {
                        const updated = { ...c, status: newStatus };
                        // 상담 상태가 초기화/취소되면 모든 관련 예약 정보도 로컬에서 비움
                        if (['상담중', '견적제공', '취소', '취소/보류', '상담완료'].includes(newStatus)) {
                            updated.confirmedProduct = '';
                            updated.confirmedDate = '';
                            updated.prepaidDate = '';
                            updated.noticeDate = '';
                            updated.balanceDate = '';
                            updated.confirmationSent = '';
                            updated.departureNotice = '';
                            updated.phoneNotice = '';
                            updated.happyCall = '';
                        }
                        return updated;
                    }
                    return c;
                }));
            } else {
                alert('상태 변경에 실패했습니다: ' + data.error);
            }
        } catch (error) {
            console.error('상태 변경 오류:', error);
            alert('상태 변경 중 오류가 발생했습니다.');
        } finally {
            setUpdating(null);
        }
    };

    const handleConfirmReservation = async () => {
        if (!confirmModal || !confirmUrl.trim()) {
            alert('확정상품 URL을 입력해주세요.');
            return;
        }

        const { chat } = confirmModal;
        setConfirming(true);

        try {
            const response = await fetch('/api/consultations/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: chat.sheetRowIndex,
                    sheetName: chat.sheetName,
                    confirmedProductUrl: confirmUrl.trim(),
                }),
            });

            const data = await response.json();
            if (data.success) {
                // 로컬 상태 업데이트
                setChats(prev => prev.map(c =>
                    c.id === chat.id ? {
                        ...c,
                        status: '예약확정',
                        confirmedProduct: data.data.confirmedProductUrl,
                        confirmedDate: data.data.confirmedDate,
                        departureDate: data.data.departureDate || c.departureDate,
                        returnDate: data.data.returnDate || c.returnDate,
                        destination: data.data.destination || c.destination,
                        prepaidDate: data.data.prepaidDate,
                        noticeDate: data.data.noticeDate,
                        balanceDate: data.data.balanceDate,
                        confirmationSent: data.data.confirmationSent,
                        departureNotice: data.data.departureNotice,
                        phoneNotice: data.data.phoneNotice,
                        happyCall: data.data.happyCall,
                    } : c
                ));
                setConfirmModal(null);
                setConfirmUrl('');
                alert(`예약확정 완료! 출발일: ${data.data.departureDate || '미정'}, 귀국일: ${data.data.returnDate || '미정'}`);
            } else {
                alert('예약확정 실패: ' + data.error);
            }
        } catch (error) {
            console.error('예약확정 오류:', error);
            alert('예약확정 처리 중 오류가 발생했습니다.');
        } finally {
            setConfirming(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const formatDateOnly = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 고유 월 목록 추출 및 자동 선택 로직
    const allMonths = Array.from(new Set(chats.map(c => {
        if (!c.lastMessageAt) return '';
        const d = new Date(c.lastMessageAt);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }).filter(Boolean))).sort().reverse();

    useEffect(() => {
        if (!selectedMonth && allMonths.length > 0) {
            setSelectedMonth(allMonths[0]);
        }
    }, [allMonths, selectedMonth]);

    const monthFilteredChats = selectedMonth
        ? chats.filter(c => c.lastMessageAt && c.lastMessageAt.startsWith(selectedMonth))
        : chats;

    const filteredChats = searchQuery
        ? monthFilteredChats.filter(chat =>
            chat.visitorName.includes(searchQuery) ||
            chat.destination.includes(searchQuery) ||
            chat.productName.includes(searchQuery)
        )
        : monthFilteredChats;

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredChats.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredChats.map(c => c.id)));
        }
    };

    const handleBulkDelete = async () => {
        const selectedItems = filteredChats.filter(c => selectedIds.has(c.id));

        if (selectedItems.length === 0) {
            alert('삭제할 항목을 선택해주세요.');
            return;
        }

        // 시트에 있는 항목과 없는 항목 분리
        const sheetItems = selectedItems.filter(c => c.sheetRowIndex);
        const orphanedItems = selectedItems.filter(c => !c.sheetRowIndex);

        setDeleting(true);
        let successCount = 0;
        let failCount = 0;

        // 1. 시트에 있는 항목들 삭제 (행 인덱스 내림차순 정렬)
        const sortedSheetItems = [...sheetItems].sort((a, b) => (b.sheetRowIndex || 0) - (a.sheetRowIndex || 0));

        for (const chat of sortedSheetItems) {
            try {
                const url = `/api/consultations?rowIndex=${chat.sheetRowIndex}${chat.sheetName ? `&sheetName=${encodeURIComponent(chat.sheetName)}` : ''}`;
                const response = await fetch(url, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error('삭제 실패:', data.error);
                }
            } catch (err) {
                failCount++;
                console.error('삭제 오류:', err);
            }
        }

        // 2. 시트에 없는 항목들 정리
        if (orphanedItems.length > 0) {
            try {
                const response = await fetch('/api/chats/cleanup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ids: orphanedItems.map(c => c.id),
                    }),
                });
                const data = await response.json();
                if (data.success) {
                    successCount += orphanedItems.length;
                }
            } catch (err) {
                // 에러가 나도 로컬에서는 제거
                successCount += orphanedItems.length;
            }
        }

        setDeleting(false);
        setShowDeleteConfirm(false);
        setSelectedIds(new Set());

        if (successCount > 0) {
            alert(`${successCount}개 삭제 완료${failCount > 0 ? `, ${failCount}개 실패` : ''}`);
            fetchChats();
        } else {
            alert('삭제에 실패했습니다.');
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return '방금 전';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
        return `${Math.floor(diff / 86400000)}일 전`;
    };

    const openGoogleSheet = (e: React.MouseEvent, rowIndex?: number, sheetName?: string, sheetGid?: number) => {
        e.preventDefault();
        e.stopPropagation();
        const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;

        if (sheetId) {
            const baseUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
            const gidParam = sheetGid !== undefined ? `gid=${sheetGid}` : '';
            const rangeParam = rowIndex ? `range=A${rowIndex}` : '';

            let finalUrl = baseUrl;
            const params = [gidParam, rangeParam].filter(Boolean).join('&');
            if (params) {
                finalUrl += `#${params}`;
            }

            console.log('Opening Google Sheet:', finalUrl);
            window.open(finalUrl, '_blank');
        } else {
            console.error('NEXT_PUBLIC_SHEET_ID is missing');
            alert('구글 시트 ID가 설정되지 않았습니다. .env 파일을 확인해 주세요.');
        }
    };

    const getStatusStyle = (status: string) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS['상담중'];
        return {
            backgroundColor: `${colors.bg}20`,
            border: `1px solid ${colors.bg}50`,
            color: colors.bg === '#3b82f6' ? '#60a5fa' : (colors.bg === '#f59e0b' ? '#fbbf24' : (colors.bg === '#10b981' ? '#34d399' : (colors.bg === '#8b5cf6' ? '#a78bfa' : (colors.bg === '#ef4444' ? '#f87171' : colors.text)))),
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-block',
        };
    };



    if (loading) {
        return <div className="loading-spinner">상담 목록 불러오는 중...</div>;
    }

    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">상담 목록</h1>
                <p className="page-subtitle">카카오톡 채널 상담 내역을 확인하고 관리하세요</p>
            </header>

            {/* 월별 탭 */}
            {allMonths.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
                    <button
                        onClick={() => setSelectedMonth('')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: selectedMonth === '' ? '#3b82f6' : '#374151',
                            backgroundColor: selectedMonth === '' ? '#3b82f620' : '#1f2937',
                            color: selectedMonth === '' ? '#60a5fa' : '#9ca3af',
                            cursor: 'pointer',
                            fontWeight: selectedMonth === '' ? 600 : 400,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                        }}
                    >
                        전체 내역
                    </button>
                    {allMonths.map(month => (
                        <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: '1px solid',
                                borderColor: selectedMonth === month ? '#3b82f6' : '#374151',
                                backgroundColor: selectedMonth === month ? '#3b82f620' : '#1f2937',
                                color: selectedMonth === month ? '#60a5fa' : '#9ca3af',
                                cursor: 'pointer',
                                fontWeight: selectedMonth === month ? 600 : 400,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                            }}
                        >
                            {month.split('-')[0]}년 {month.split('-')[1]}월
                        </button>
                    ))}
                </div>
            )}

            {/* 고급 검색 바 디자인 */}
            <div style={{
                backgroundColor: '#1f2937',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                flexWrap: 'wrap'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="고객명, 목적지, 상품명으로 검색..."
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 12px',
                            backgroundColor: '#111827',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '14px',
                            transition: 'border-color 0.2s',
                            outline: 'none',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#374151'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <select
                    style={{
                        padding: '10px 12px',
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        minWidth: '140px',
                        outline: 'none',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#374151'}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">전체 상태</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="action-button"
                        onClick={() => fetchChats(true)}
                        title="최신 데이터 불러오기"
                        style={{ padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        새로고침
                    </button>
                    <button
                        className="action-button"
                        onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID || ''}`, '_blank')}
                        style={{ padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10b981', color: 'white', border: 'none' }}
                    >
                        시트 열기
                    </button>
                </div>
            </div>
            {/* 일괄 삭제 툴바 */}
            {selectedIds.size > 0 && (
                <div style={{
                    backgroundColor: '#1f2937',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#fff',
                }}>
                    <span style={{ fontWeight: 500 }}>
                        {selectedIds.size}개 선택됨
                    </span>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                        }}
                    >
                        선택 삭제
                    </button>
                </div>
            )}

            {/* 상담 목록 */}
            {
                filteredChats.length === 0 ? (
                    <div className="empty-state-small">
                        {searchQuery ? '검색 결과가 없습니다.' : '아직 상담 내역이 없습니다.'}
                    </div>
                ) : (
                    <div style={{ backgroundColor: '#111827', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <div style={{ minWidth: '800px' }}>
                                {/* 헤더 */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '40px 100px 1fr 90px 130px 90px 50px',
                                    padding: '12px 16px',
                                    backgroundColor: '#1f2937',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    color: '#9ca3af',
                                    gap: '16px',
                                }}>
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredChats.length && filteredChats.length > 0}
                                            onChange={toggleSelectAll}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div>상담일자</div>
                                    <div>고객 정보</div>
                                    <div>상태</div>
                                    <div>상태 변경</div>
                                    <div>최근 활동</div>
                                    <div>시트</div>
                                </div>

                                {/* 목록 */}
                                 {filteredChats.map((chat, idx) => {
                                     const isExpanded = expandedId === chat.id;
                                     const today = new Date().toISOString().split('T')[0];
 
                                     return (
                                         <div key={`${chat.id}-${idx}`}>
                                            <div
                                                onClick={(e) => {
                                                    // Don't expand if clicking on interactive elements
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'OPTION' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('a') || target.closest('select') || target.closest('button')) return;
                                                    const newExpandedId = isExpanded ? null : chat.id;
                                                    setExpandedId(newExpandedId);
                                                    if (newExpandedId && chat.visitorPhone) {
                                                        fetchCustomerHistory(chat.id, chat.visitorPhone);
                                                    }
                                                }}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '40px 100px 1fr 90px 130px 90px 50px',
                                                    padding: '16px',
                                                    borderBottom: isExpanded ? 'none' : '1px solid #374151',
                                                    alignItems: 'center',
                                                    backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.05)' : (selectedIds.has(chat.id) ? '#37415150' : '#111827'),
                                                    transition: 'background-color 0.2s',
                                                    gap: '16px',
                                                    cursor: 'pointer',
                                                    borderLeft: isExpanded ? '3px solid #3b82f6' : '3px solid transparent',
                                                }}
                                            >
                                                {/* 체크박스 */}
                                                <div>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(chat.id)}
                                                        onChange={() => toggleSelect(chat.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </div>

                                                {/* 상담일자 */}
                                                <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>
                                                    {formatDateOnly(chat.lastMessageAt)}
                                                </div>

                                                {/* 고객 정보 */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {chat.visitorName || (chat.source === '카카오톡' || !chat.source ? '[K]미정' : '(이름 미정)')}
                                                            {(chat.source === '카카오톡' || !chat.source) && chat.id.startsWith('sheet-') === false && (
                                                                <span style={{ backgroundColor: '#FEE500', color: '#000', fontSize: '10px', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>K</span>
                                                            )}
                                                            {chat.recurringCustomer === '재방문' && (
                                                                <span style={{ backgroundColor: '#3b82f620', color: '#60a5fa', fontSize: '10px', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>재방문</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '10px' }}>
                                                            {chat.destination && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontWeight: 500 }}>
                                                                    <MapPin size={12} style={{ flexShrink: 0 }} /> 
                                                                    <span style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={chat.destination}>{chat.destination}</span>
                                                                </span>
                                                            )}
                                                            {chat.departureDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 500 }}><Calendar size={12} /> {chat.departureDate}</span>}
                                                            {chat.travelersCount && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 500 }}><Users size={12} /> {chat.travelersCount}명</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 상태 배지 */}
                                                <div>
                                                    <span style={getStatusStyle(chat.status)}>
                                                        {chat.status}
                                                    </span>
                                                </div>

                                                {/* 상태 변경 드롭다운 */}
                                                <div>
                                                    <select
                                                        value={chat.status}
                                                        onChange={(e) => handleStatusChange(chat, e.target.value)}
                                                        disabled={updating === chat.id}
                                                        style={{
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            border: '1px solid #374151',
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            backgroundColor: updating === chat.id ? '#374151' : '#1f2937',
                                                            color: '#fff',
                                                            width: '100%',
                                                        }}
                                                    >
                                                        {STATUS_OPTIONS.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 최근 활동 */}
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {formatTime(chat.lastMessageAt)}
                                                </div>

                                                {/* 시트 링크 */}
                                                <div>
                                                    <button
                                                        onClick={(e) => openGoogleSheet(e, chat.sheetRowIndex, chat.sheetName, chat.sheetGid)}
                                                        title={`Google Sheets (${chat.sheetName || '기본'})에서 보기`}
                                                        style={{
                                                            padding: '6px 8px',
                                                            border: '1px solid #374151',
                                                            borderRadius: '4px',
                                                            backgroundColor: '#1f2937',
                                                            cursor: 'pointer',
                                                            color: '#9ca3af',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        열기
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ── Expandable Detail Panel ── */}
                                            {isExpanded && (
                                                <div style={{
                                                    padding: '20px 24px',
                                                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(139, 92, 246, 0.03))',
                                                    borderBottom: '2px solid #3b82f6',
                                                    borderLeft: '3px solid #3b82f6',
                                                    animation: 'fadeSlideDown 0.2s ease-out',
                                                }}>
                                                    {/* Row 1: Customer + Trip Info */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                        {/* Customer Info Card & History */}
                                                        <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151', display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                                                                <h4 style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 700, margin: 0 }}>고객 정보</h4>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setEditingCustomerChatId(editingCustomerChatId === chat.id ? null : chat.id); }}
                                                                    style={{ background: editingCustomerChatId === chat.id ? '#10b98120' : 'transparent', color: editingCustomerChatId === chat.id ? '#34d399' : '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    {editingCustomerChatId === chat.id ? '완료' : <><Pencil size={12} /> 편집</>}
                                                                </button>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                                                <EditableField 
                                                                    label="고객명" 
                                                                    value={chat.visitorName} 
                                                                    field="visitorName" 
                                                                    chatId={chat.id} 
                                                                    onSave={handleFieldUpdate} 
                                                                    forceEditMode={editingCustomerChatId === chat.id} 
                                                                    displayValue={chat.visitorName || (chat.source === '카카오톡' || !chat.source ? '[K]미정' : '(이름 미정)')}
                                                                />
                                                                <EditableField label="연락처" value={chat.visitorPhone} field="visitorPhone" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingCustomerChatId === chat.id} />
                                                                <EditableField label="총인원" value={chat.travelersCount} field="travelersCount" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingCustomerChatId === chat.id} />
                                                                <EditableField label="재방문여부" value={chat.recurringCustomer} field="recurringCustomer" chatId={chat.id} onSave={handleFieldUpdate} options={['신규고객', '재방문', '장기미방문', '정보없음']} forceEditMode={editingCustomerChatId === chat.id} />
                                                                <EditableField label="유입경로" value={chat.inquirySource} field="inquirySource" chatId={chat.id} onSave={handleFieldUpdate} options={['네이버 블로그', '카카오톡 채널', '인스타그램 및 페이스북', '당근마켓', '닷컴', '지인소개', '기존고객', '전화문의', '매장방문', '기타']} forceEditMode={editingCustomerChatId === chat.id} />
                                                                <InfoCell label="등록방식" value={chat.source || '-'} highlight={chat.source === '카카오톡' ? '#fbbf24' : '#a78bfa'} />
                                                            </div>

                                                        </div>

                                                        {/* Trip Info Card */}
                                                        <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                                                                <h4 style={{ color: '#34d399', fontSize: '13px', fontWeight: 700, margin: 0 }}>여행 정보</h4>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setEditingTripChatId(editingTripChatId === chat.id ? null : chat.id); }}
                                                                    style={{ background: editingTripChatId === chat.id ? '#10b98120' : 'transparent', color: editingTripChatId === chat.id ? '#34d399' : '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    {editingTripChatId === chat.id ? '완료' : <><Pencil size={12} /> 편집</>}
                                                                </button>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                                                <EditableField label="목적지" value={chat.destination} field="destination" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === chat.id} />
                                                                <EditableField label="출발일" value={chat.departureDate} field="departureDate" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === chat.id} />
                                                                <EditableField label="귀국일" value={chat.returnDate} field="returnDate" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === chat.id} />
                                                                <EditableField label="기간" value={chat.duration} field="duration" chatId={chat.id} onSave={handleFieldUpdate} forceEditMode={editingTripChatId === chat.id} />
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
                                                                const names = robustSplit(chat.productName || '');
                                                                const urls = robustSplit(chat.productUrl || '');
                                                                const maxLen = Math.max(names.length, urls.length, 1);
                                                                const isMultiple = names.length > 1 || urls.length > 1 || (chat.productName || '').includes(',') || (chat.productUrl || '').includes(',');

                                                                return (
                                                                    <div style={{ marginTop: '10px' }}>
                                                                        <div style={{ fontSize: '11px', color: isMultiple ? '#f59e0b' : '#34d399', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                                                                            {isMultiple ? `비교 상품 (${maxLen}개)` : `상담 상품`}
                                                                        </div>
                                                                        
                                                                        {/* 편집 모드 */}
                                                                        {(editingTripChatId === chat.id) ? (
                                                                            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px', padding: '12px', background: '#111827', borderRadius: '8px', border: '1px dashed #374151' }}>
                                                                                <EditableField 
                                                                                    label={isMultiple ? "전체 상품명 (콤마/줄바꿈 구분)" : "상품명"} 
                                                                                    value={chat.productName} 
                                                                                    field="productName" 
                                                                                    chatId={chat.id} 
                                                                                    onSave={handleFieldUpdate} 
                                                                                    wide 
                                                                                    forceEditMode={true} 
                                                                                />
                                                                                <EditableField 
                                                                                    label={isMultiple ? "전체 상품 URL (콤마/줄바꿈 구분)" : "상품 URL"} 
                                                                                    value={chat.productUrl} 
                                                                                    field="productUrl" 
                                                                                    chatId={chat.id} 
                                                                                    onSave={handleFieldUpdate} 
                                                                                    wide 
                                                                                    forceEditMode={true}
                                                                                    displayValue={chat.productUrl ? <span style={{ color: '#38bdf8' }}>🔗 링크 {isMultiple ? '복수 ' : ''}등록됨 (수정)</span> : undefined}
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

                                                    {/* 아래 Row: 방문 이력 (재방문 고객용) - 100% 폭 사용 */}
                                                    {(() => {
                                                        const history = customerHistoryByPhone[chat.visitorPhone];
                                                        const isLoadingHistory = historyLoading === chat.id;
                                                        
                                                        if (isLoadingHistory) {
                                                            return (
                                                                <div style={{ marginBottom: '16px', padding: '16px', background: '#1f2937', borderRadius: '10px', border: '1px solid #374151' }}>
                                                                    <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600 }}>이전 방문 이력을 불러오는 중입니다...</span>
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        if (!history || history.length < 2) return null;

                                                        // 현재 상담 제외 이전 방문만 리스트화 후, 상품명+URL 기준으로 중복 제거
                                                        const previousVisitsMap = new Map();
                                                        history.filter((h: any) =>
                                                            h.sheetName !== chat.sheetName || h.consultationDate !== chat.lastMessageAt
                                                        ).slice(0, -1).forEach((h: any) => {
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
                                                                        // 문의는 상담일자(consultationDate), 예약확정은 출발일(departureDate)을 노출
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
                                                            value={chat.summary || ''} 
                                                            field="summary" 
                                                            chatId={chat.id} 
                                                            onSave={handleFieldUpdate} 
                                                            allowClickToEdit={true}
                                                            multiline={true}
                                                            displayValue={
                                                                <div style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.7', whiteSpace: 'pre-wrap', background: '#111827', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24', width: '100%', minHeight: '40px' }}>
                                                                    {chat.summary || <span style={{ color: '#6b7280' }}>여기를 클릭하여 요약을 작성하거나 수정하세요.</span>}
                                                                </div>
                                                            }
                                                        />
                                                    </div>

                                                    {/* Row 3: Automation Timeline */}
                                                    <div style={{ background: '#1f2937', borderRadius: '10px', padding: '16px', border: '1px solid #374151' }}>
                                                        <h4 style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>진행 현황</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                            <TimelineCell label="팔로업일" date={chat.nextFollowup} today={today} field="nextFollowup" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                            {chat.status !== '상담중' && chat.status !== '견적제공' && (
                                                                <>
                                                                    <TimelineCell label="예약확정일" date={chat.confirmedDate} today={today} field="confirmedDate" chatId={chat.id} />
                                                                    <TimelineCell label="선금일" date={chat.prepaidDate} today={today} field="prepaidDate" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                </>
                                                            )}
                                                            {chat.status !== '상담중' && chat.status !== '견적제공' && (
                                                                <>
                                                                    <TimelineCell label="출발전안내" date={chat.noticeDate} today={today} field="noticeDate" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                    <TimelineCell label="잔금일" date={chat.balanceDate} today={today} field="balanceDate" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                    <TimelineCell label="확정서발송" date={chat.confirmationSent} today={today} field="confirmationSent" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                    <TimelineCell label="출발안내" date={chat.departureNotice} today={today} field="departureNotice" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                    <TimelineCell label="전화안내" date={chat.phoneNotice} today={today} field="phoneNotice" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                    <TimelineCell label="해피콜" date={chat.happyCall} today={today} field="happyCall" chatId={chat.id} onCheck={handleFieldUpdate} />
                                                                </>
                                                            )}
                                                            {chat.confirmedProduct && (
                                                                <div style={{ gridColumn: 'span 1', padding: '8px', background: '#111827', borderRadius: '6px', fontSize: '11px' }}>
                                                                    <div style={{ color: '#6b7280', marginBottom: '4px' }}>확정상품</div>
                                                                    <a href={chat.confirmedProduct} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: '11px', textDecoration: 'none' }}>열기 →</a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: '#6b7280' }}>
                                                        <span>📋 상담일시: {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString('ko-KR') : '-'}</span>
                                                        <Link href={`/chats/${chat.id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                                                            💬 대화내역 보기 →
                                                        </Link>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            {/* 삭제 확인 팝업 */}
            {showDeleteConfirm && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => !deleting && setShowDeleteConfirm(false)}
                >
                    <div
                        style={{
                            backgroundColor: '#1f2937',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                            color: '#fff',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>일괄 삭제 확인</h3>
                        <p style={{ color: '#9ca3af', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                            선택한 <strong style={{ color: '#fff' }}>{selectedIds.size}개</strong>의 상담 내역을 삭제하시겠습니까?
                            <br /><br />
                            <span style={{ color: '#ef4444', fontSize: '14px' }}>
                                ⚠️ 이 작업은 Google Sheets에서도 해당 데이터를 삭제합니다.
                                <br />복구할 수 없습니다.
                            </span>
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: '1px solid #374151',
                                    backgroundColor: '#374151',
                                    color: '#fff',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    opacity: deleting ? 0.5 : 1,
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={deleting}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    opacity: deleting ? 0.7 : 1,
                                }}
                            >
                                {deleting ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 예약확정 모달 */}
            {confirmModal && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => !confirming && setConfirmModal(null)}
                >
                    <div
                        style={{
                            backgroundColor: '#1f2937', borderRadius: '16px',
                            padding: '28px', maxWidth: '500px', width: '90%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                            color: '#fff', border: '1px solid #10b981',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '24px' }}>✅</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>예약확정</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>
                                    {confirmModal.chat.visitorName} 고객의 확정상품 URL을 입력하세요
                                </p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                확정상품 URL
                            </label>
                            <input
                                type="url"
                                placeholder="https://www.modetour.com/..."
                                value={confirmUrl}
                                onChange={(e) => setConfirmUrl(e.target.value)}
                                disabled={confirming}
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px 14px',
                                    backgroundColor: '#111827', border: '1px solid #374151',
                                    borderRadius: '8px', color: '#fff', fontSize: '14px',
                                    outline: 'none', transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                onBlur={(e) => e.target.style.borderColor = '#374151'}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmReservation()}
                            />
                        </div>

                        <div style={{
                            backgroundColor: '#111827', borderRadius: '8px',
                            padding: '12px 14px', marginBottom: '20px',
                            fontSize: '12px', color: '#9ca3af', lineHeight: '1.6',
                        }}>
                            <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '6px' }}>자동으로 계산되는 항목:</div>
                            📅 출발일/귀국일 (URL에서 추출) · 📍 목적지<br />
                            💰 선금일 (확정+2일) · 📢 출발전안내 (출발-4주)<br />
                            💳 잔금일 (출발-3주) · 📨 확정서발송 (출발-2주)<br />
                            🛫 출발안내 (-3일) · 📞 전화안내 (-1일) · 🎉 해피콜 (귀국+1일)
                        </div>

                        {confirming && (
                            <div style={{ textAlign: 'center', padding: '12px', color: '#10b981', fontSize: '14px', marginBottom: '12px' }}>
                                ⏳ URL 분석 및 날짜 계산 중...
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmModal(null)}
                                disabled={confirming}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px',
                                    border: '1px solid #374151', backgroundColor: '#374151',
                                    color: '#fff', cursor: confirming ? 'not-allowed' : 'pointer',
                                    fontSize: '14px', opacity: confirming ? 0.5 : 1,
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirmReservation}
                                disabled={confirming || !confirmUrl.trim()}
                                style={{
                                    padding: '10px 24px', borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: confirming ? '#065f46' : '#10b981',
                                    color: 'white',
                                    cursor: confirming || !confirmUrl.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '14px', fontWeight: 600,
                                    opacity: !confirmUrl.trim() ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {confirming ? '처리 중...' : '예약확정 진행'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


