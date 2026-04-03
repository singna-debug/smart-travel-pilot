"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import React from "react";

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // If the path is exactly /confirmation (admin page), we show the sidebar.
    // If the path is /confirmation/[id] (client viewer), or if it is the /login page, we hide the sidebar.
    const isFullScreenPage = 
        (pathname?.startsWith("/confirmation/") && pathname !== "/confirmation") || 
        pathname === "/login";

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
