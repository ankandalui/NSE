"use client";

import { useEffect, useState } from "react";
import {
  requestNotificationPermission,
  onMessageListener,
  messaging,
} from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { onMessage } from "firebase/messaging";

export default function NotificationHandler() {
  const [notification, setNotification] = useState<{
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    // Request notification permission when component mounts
    const requestPermission = async () => {
      try {
        const token = await requestNotificationPermission();
        if (token) {
          console.log("Notification permission granted");
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };

    // Only request permission in production or if explicitly enabled
    if (
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === "true"
    ) {
      requestPermission();
    }

    // Set up message listener for foreground notifications
    const unsubscribe = onMessageListener();

    // Listen for messages and update notification state
    if (typeof unsubscribe === "function") {
      onMessage(messaging, (payload) => {
        if (payload?.notification) {
          setNotification({
            title: payload.notification.title || "New Notification",
            body: payload.notification.body || "",
          });
        }
        return payload;
      });
    }

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Show toast notification when a new notification is received
  useEffect(() => {
    if (notification) {
      toast(
        <div>
          <h4 className="font-bold">{notification.title}</h4>
          <p>{notification.body}</p>
        </div>,
        {
          duration: 6000,
          position: "top-right",
        }
      );
    }
  }, [notification]);

  // This component doesn't render anything visible
  return null;
}
