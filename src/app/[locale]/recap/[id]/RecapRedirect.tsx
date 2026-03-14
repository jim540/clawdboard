"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RecapRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="font-mono text-sm text-muted">Redirecting to clawdboard...</p>
    </div>
  );
}
