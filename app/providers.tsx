"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Toaster } from "react-hot-toast";

// Dynamically import the NotificationHandler with no SSR
const NotificationHandler = dynamic(
  () => import("@/components/NotificationHandler"),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Toaster />
      <NotificationHandler />
    </>
  );
}
