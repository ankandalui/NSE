// Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Firebase Messaging - only in browser environment
let messaging: any = null;

// Only initialize messaging in browser environment
if (typeof window !== "undefined") {
  try {
    // Register the service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/api/firebase-messaging-sw")
        .then((registration) => {
          console.log(
            "Service Worker registered with scope:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }

    messaging = getMessaging(app);
    console.log("Firebase messaging initialized");
  } catch (error) {
    console.error("Error initializing Firebase messaging:", error);
  }
}

// Function to request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  if (!messaging) return null;

  try {
    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      console.log("FCM Token:", token);
      return token;
    } else {
      console.log("Notification permission denied");
      return null;
    }
  } catch (error) {
    console.error("Error getting notification permission:", error);
    return null;
  }
};

// Function to handle foreground messages
export const onMessageListener = () => {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("Message received in foreground:", payload);
    return payload;
  });
};

export { db, messaging };
