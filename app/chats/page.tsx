'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ChatItem {
    id: string;
    visitorName: string;
    visitorPhone: string;
    destination: string;
    productName: string;
    departureDate: string;
    status: string;
    lastMessage: string;
    lastMessageAt: string;
    messageCount: number;
    sheetRowIndex?: number;
}

const STATUS_OPTIONS = ['상담중', '견적제공', '예약확정', '결제완료', '상담완료', '취소'];

// 다크 테마 색상
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    '상담중': { bg: '#3b82f6', text: '#fff' },
    '견적제공': { bg: '#f59e0b', text: '#fff' },
    '예약확정': { bg: '#10b981', text: '#fff' },
    '결제완료': { bg: '#8b5cf6', text: '#fff' },
    '상담완료': { bg: '#6b7280', text: '#fff' },
    '취소': { bg: '#ef4444', text: '#fff' },
};

export default function ChatsPage() {
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 30000);
        return () => clearInterval(interval);
    }, [statusFilter]);

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

        setUpdating(chat.id);
        try {
            const response = await fetch('/api/consultations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: chat.sheetRowIndex,
                    status: newStatus,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setChats(prev => prev.map(c =>
                    c.id === chat.id ? { ...c, status: newStatus } : c
                ));
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
                const response = await fetch(
                    `/api/consultations?rowIndex=${chat.sheetRowIndex}`,
                    { method: 'DELETE' }
                );
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

    const openGoogleSheet = (e: React.MouseEvent, rowIndex?: number) => {
        e.preventDefault();
        e.stopPropagation();
        const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;
        if (sheetId && rowIndex) {
            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0&range=A${rowIndex}`, '_blank');
        } else if (sheetId) {
            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, '_blank');
        }
    };

    const getStatusStyle = (status: string) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS['상담중'];
        return {
            backgroundColor: colors.bg,
            color: colors.text,
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-block',
        };
    };

    const filteredChats = searchQuery
        ? chats.filter(chat =>
            chat.visitorName.includes(searchQuery) ||
            chat.destination.includes(searchQuery) ||
            chat.productName.includes(searchQuery)
        )
        : chats;

    if (loading) {
        return <div className="loading-spinner">상담 목록 불러오는 중...</div>;
    }

    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">💬 상담 목록</h1>
                <p className="page-subtitle">카카오톡 채널 상담 내역을 확인하고 관리하세요</p>
            </header>

            {/* 검색 및 필터 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="고객명, 목적지, 상품명으로 검색..."
                    className="search-input"
                    style={{ flex: 1, minWidth: '200px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <select
                    className="search-input"
                    style={{ maxWidth: 150 }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">전체 상태</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <button
                    className="action-button"
                    onClick={() => fetchChats(true)}
                    title="최신 데이터 불러오기"
                >
                    🔄 새로고침
                </button>
                <button
                    className="action-button"
                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID || ''}`, '_blank')}
                >
                    📊 시트 열기
                </button>
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
                        🗑️ 선택 삭제
                    </button>
                </div>
            )}

            {/* 상담 목록 */}
            {filteredChats.length === 0 ? (
                <div className="empty-state-small">
                    {searchQuery ? '검색 결과가 없습니다.' : '아직 상담 내역이 없습니다.'}
                </div>
            ) : (
                <div style={{ backgroundColor: '#111827', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* 헤더 */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 90px 130px 90px 50px',
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
                        <div>고객 정보</div>
                        <div>상태</div>
                        <div>상태 변경</div>
                        <div>최근 활동</div>
                        <div>시트</div>
                    </div>

                    {/* 목록 */}
                    {filteredChats.map((chat) => (
                        <div
                            key={chat.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr 90px 130px 90px 50px',
                                padding: '16px',
                                borderBottom: '1px solid #374151',
                                alignItems: 'center',
                                backgroundColor: selectedIds.has(chat.id) ? '#1f2937' : '#111827',
                                transition: 'background-color 0.2s',
                                gap: '16px',
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

                            {/* 고객 정보 */}
                            <Link href={`/chats/${chat.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        backgroundColor: '#374151',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                    }}>
                                        👤
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, color: '#fff', marginBottom: '2px' }}>
                                            {chat.visitorName}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                            {chat.destination && <span style={{ marginRight: '8px' }}>📍 {chat.destination}</span>}
                                            {chat.departureDate && <span>📅 {chat.departureDate}</span>}
                                        </div>
                                    </div>
                                </div>
                            </Link>

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
                                    onClick={(e) => openGoogleSheet(e, chat.sheetRowIndex)}
                                    title="Google Sheets에서 보기"
                                    style={{
                                        padding: '6px 8px',
                                        border: '1px solid #374151',
                                        borderRadius: '4px',
                                        backgroundColor: '#1f2937',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    📊
                                </button>
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}
