'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, MessageSquareText, FileText, GraduationCap, PenLine, Wrench, Mail, MessageCircle, TableProperties, Plane, PieChart, LogOut, CalendarDays, Clock, Settings } from 'lucide-react';
import { logout } from '@/app/login/actions';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: '/', label: '대시보드', icon: <BarChart2 size={20} /> },
    { href: '/analytics', label: '데이터 분석', icon: <PieChart size={20} /> },
    { href: '/chats', label: '상담 목록', icon: <MessageSquareText size={20} /> },
    { href: '/confirmation', label: '확정서 제작', icon: <FileText size={20} /> },
    { href: '/products', label: '상품 교육', icon: <GraduationCap size={20} /> },
    { href: '/manual-log', label: '수동 상담', icon: <PenLine size={20} /> },
    { href: '/tools', label: 'URL 분석', icon: <Wrench size={20} /> },
    { href: '/messages', label: '멘트제작', icon: <Mail size={20} /> },
    { href: '/calendar', label: '캘린더', icon: <CalendarDays size={20} /> },
    { href: '/attendance', label: '근태관리', icon: <Clock size={20} /> },
    { href: '/settings', label: '설정', icon: <Settings size={20} /> },
];

export default function Sidebar() {
    const pathname = usePathname();
    const isDummyMode = pathname ? pathname.startsWith('/dummy') : false;

    // Helper to get dummy-aware link href
    const getHref = (href: string) => {
        if (!isDummyMode) return href;
        if (href === '/') return '/dummy';
        return `/dummy${href}`;
    };

    // Helper to check if current path is active
    const isActive = (href: string) => {
        if (!pathname) return false;
        const targetHref = getHref(href);
        if (targetHref === '/dummy') {
            return pathname === '/dummy';
        }
        return pathname === targetHref || pathname.startsWith(targetHref + '/');
    };

    return (
        <aside className="sidebar">
            <Link href={isDummyMode ? "/dummy" : "/"} style={{ textDecoration: 'none' }}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <Plane size={28} strokeWidth={2.5} style={{ transform: 'rotate(-45deg)', color: '#fff' }} />
                    </div>
                    <div className="sidebar-title">
                        <h1>Smart Travel</h1>
                        {isDummyMode ? <span style={{ color: '#fbbf24' }}>Pilot [더미]</span> : <span>Pilot</span>}
                    </div>
                </div>
            </Link>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={getHref(item.href)}
                            className={`nav-item ${active ? 'active' : ''}`}
                        >
                            <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.icon}
                            </span>
                            <span className="nav-label">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>


            <div className="sidebar-footer">
                <a
                    href="https://center-pf.kakao.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-item external"
                >
                    <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={20} />
                    </span>
                    <span className="nav-label">카카오 채널</span>
                    <span className="external-icon">↗</span>
                </a>
                <button
                    onClick={async () => {
                        const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
                        const savedSettings = typeof window !== 'undefined' ? localStorage.getItem('tenant_settings') : null;
                        let customSheetId = null;
                        if (savedSettings) {
                            try { customSheetId = JSON.parse(savedSettings).googleSpreadsheetId; } catch(e){}
                        }

                        // 사장님 본인 계정이면 사장님 구글 시트 연결
                        if (!tenantId || tenantId === 'default_tenant') {
                            const sheetId = process.env.NEXT_PUBLIC_SHEET_ID || '17Q0J_O13426hV2e951Q7z-8n3g8735391';
                            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank');
                        } else if (customSheetId) {
                            window.open(`https://docs.google.com/spreadsheets/d/${customSheetId}/edit`, '_blank');
                        } else {
                            alert('⚙️ [설정] 페이지에서 사장님/여행사 전용 구글 시트 ID를 먼저 연결 후 이용해 주세요.');
                        }
                    }}
                    className="nav-item external"
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                >
                    <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TableProperties size={20} />
                    </span>
                    <span className="nav-label">Google Sheets</span>
                    <span className="external-icon">↗</span>
                </button>

                {/* Logout Button */}
                <button 
                    onClick={async () => {
                        if (confirm('로그아웃 하시겠습니까?')) {
                            await logout();
                        }
                    }} 
                    className="nav-item-logout"
                >
                    <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LogOut size={18} />
                    </span>
                    <span className="nav-label">로그아웃</span>
                </button>
            </div>
        </aside>
    );
}
