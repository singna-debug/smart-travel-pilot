"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function DemoBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if the URL has ?demo=true or if sessionStorage has demo=true
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoQuery = urlParams.get("demo") === "true";
    const isDemoSession = sessionStorage.getItem("demo") === "true";

    // Only show the banner if we are on a dummy page
    const isDummyPath = pathname ? pathname.startsWith("/dummy") : false;

    if (isDummyPath && (isDemoQuery || isDemoSession)) {
      setShowBanner(true);
      if (isDemoQuery) {
        sessionStorage.setItem("demo", "true");
      }
    } else {
      setShowBanner(false);
    }
  }, [pathname]);

  if (!showBanner) return null;

  return (
    <div style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b, #d97706)', color: '#000', textAlign: 'center', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 99999, position: 'relative' }}>
      <span>💡 본 페이지는 84컴퍼니의 기능 시현을 위한 데모(Demo) 사이트입니다. 실제 서비스 구동 환경 및 데이터와는 차이가 있을 수 있습니다.</span>
    </div>
  );
}
