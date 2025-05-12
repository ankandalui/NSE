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

  // During SSR and initial client render, just render children
  // This prevents hydration mismatches
  if (!mounted) {
    return <>{children}</>;
  }

  // Once the component has mounted on the client, we can safely render
  // client-side only components
  return (
    <>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <NotificationHandler />
    </>
  );
}
