"use client";

import { useEffect, useState } from "react";

/**
 * MobileBlockNotice
 * STEP 131.5 Phase 2 Commit 5 (Closure)
 * 옵션 Z: Desktop Only + Mobile 차단 안내
 */
export default function MobileBlockNotice() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted || !isMobile) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="데스크탑 환경 안내"
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center px-6"
    >
      <div className="flex flex-col items-center mb-12">
        <h1 className="text-2xl font-light tracking-[0.3em] text-neutral-900">
          AXVELA OS
        </h1>
        <div className="mt-3 h-px w-12 bg-neutral-300" />
        <p className="mt-3 text-xs tracking-widest text-neutral-500">
          Cultural Asset Operating System
        </p>
      </div>

      <div className="max-w-sm text-center">
        <h2 className="text-base font-medium text-neutral-900">
          데스크탑 환경에서 이용해주세요
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-500">
          AXVELA는 작품 중심의 갤러리 운영을 위해
          <br />
          PC 환경에 최적화되어 있습니다.
        </p>
      </div>

      <p className="absolute bottom-8 text-[10px] tracking-widest text-neutral-300">
        STEP 131.5 · DESKTOP ONLY
      </p>
    </div>
  );
}