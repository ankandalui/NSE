// Firebase configuration
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxd74Hs5cUCVpgVicEpBRmi6TDccv63lg",
  authDomain: "nse-chain.firebaseapp.com",
  projectId: "nse-chain",
  storageBucket: "nse-chain.firebasestorage.app",
  messagingSenderId: "948863241651",
  appId: "1:948863241651:web:79848303ba826de1208fc6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Firebase Messaging - only in browser environment
let messaging: any = null;

// Only initialize messaging in browser environment
if (typeof window !== "undefined") {
  try {
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
        vapidKey: "YOUR_VAPID_KEY_HERE", // Replace with your VAPID key if you have one
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
