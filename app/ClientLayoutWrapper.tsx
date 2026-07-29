"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import React, { useState, useEffect } from "react";

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const syncTenant = async () => {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    if (user.email === 'gktla71@gmail.com') {
                        localStorage.setItem('tenant_id', 'default_tenant');
                    } else if (user.id) {
                        localStorage.setItem('tenant_id', user.id);
                    }
                }
            } catch (e) {
                console.error('Tenant sync error in Layout:', e);
            }
        };
        syncTenant();
    }, []);

    // If the path is exactly /confirmation (admin page), we show the sidebar.
    // If the path is /confirmation/[id] (client viewer), or if it is the /login page, we hide the sidebar.
    const isFullScreenPage = 
        !pathname ||
        (pathname.startsWith("/confirmation/") && pathname !== "/confirmation") || 
        pathname === "/login";

    // 하이드레이션 엇갈림 방지: 마운트 전에는 빈 레이아웃 노출
    if (!mounted) {
        return <main className="full-screen-content">{children}</main>;
    }

    if (isFullScreenPage) {
        return <main className="full-screen-content">{children}</main>;
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">{children}</main>
        </div>
    );
}
