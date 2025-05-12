import { db } from "./firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { OptionChainData } from "@/types/optionChain";

export async function fetchLatestOptionChainData(): Promise<OptionChainData | null> {
  try {
    // Create a query to get the latest option chain data
    const q = query(
      collection(db, "optionChainData"),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    // Execute the query
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Get the first document (latest data)
    const doc = querySnapshot.docs[0];
    const data = doc.data() as Omit<OptionChainData, "timestamp"> & {
      timestamp: { toDate: () => Date };
    };

    // Convert Firestore timestamp to JavaScript Date
    return {
      ...data,
      timestamp: data.timestamp.toDate(),
    };
  } catch (error) {
    console.error("Error fetching option chain data:", error);
    return null;
  }
}

export async function triggerOptionChainScrape(): Promise<OptionChainData | null> {
  try {
    // Call the API route to scrape and store option chain data
    const response = await fetch("/api/scrape-option-chain", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Add cache: 'no-store' to prevent caching
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API error response:", errorData);
      throw new Error(
        `Failed to scrape option chain data: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    if (!result.data) {
      console.error("Invalid API response format:", result);
      throw new Error("Invalid API response format");
    }

    return result.data as OptionChainData;
  } catch (error) {
    console.error("Error triggering option chain scrape:", error);
    throw error; // Re-throw to allow the component to handle the error
  }
}
