import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  // where
} from "firebase/firestore";
import { OptionData, OptionChainData } from "@/types/optionChain";
import axios from "axios";
import { getNSEHeaders } from "@/lib/nseHeaders";

// Function to generate mock option chain data for development
function generateMockOptionChainData(): OptionChainData {
  // Use fixed seed values for development to avoid hydration mismatches
  const baseStrikePrice = 24000; // Start near the current NIFTY value
  const numStrikes = 20;
  const options: OptionData[] = [];

  // Use current NIFTY value (as of May 2023)
  const underlyingValue = 24784.2;

  // Create a simple pseudo-random function with a fixed seed
  const seedValue = 12345;
  let seed = seedValue;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < numStrikes; i++) {
    const strikePrice = baseStrikePrice + i * 50; // 50-point increments for NIFTY options
    const distanceFromCurrent = Math.abs(strikePrice - underlyingValue);

    // Generate more realistic values based on distance from current price
    const callIV = 20 + pseudoRandom() * 10 - distanceFromCurrent / 1000;
    const putIV = 20 + pseudoRandom() * 10 - distanceFromCurrent / 1000;

    // Call prices decrease as strike price increases
    const callLTP = Math.max(
      0,
      underlyingValue - strikePrice + pseudoRandom() * 100
    );
    // Put prices increase as strike price increases
    const putLTP = Math.max(
      0,
      strikePrice - underlyingValue + pseudoRandom() * 100
    );

    // Generate deterministic OI values
    const callOI = Math.floor(10000 + pseudoRandom() * 50000);
    const putOI = Math.floor(10000 + pseudoRandom() * 50000);

    // Generate change values
    const callNetChange = pseudoRandom() * 20 - 10;
    const putNetChange = pseudoRandom() * 20 - 10;

    options.push({
      strikePrice,
      expiryDate: "29-May-2025",

      // Call options data
      callOI,
      callChangeInOI: Math.floor(Math.random() * 5000 - 2500),
      callVolume: Math.floor(1000 + Math.random() * 10000),
      callIV,
      callLTP,
      callNetChange,
      callBidQty: Math.floor(10 + Math.random() * 100),
      callBidPrice: callLTP - Math.random() * 2,
      callAskPrice: callLTP + Math.random() * 2,
      callAskQty: Math.floor(10 + Math.random() * 100),

      // Put options data
      putOI,
      putChangeInOI: Math.floor(Math.random() * 5000 - 2500),
      putVolume: Math.floor(1000 + Math.random() * 10000),
      putIV,
      putLTP,
      putNetChange,
      putBidQty: Math.floor(10 + Math.random() * 100),
      putBidPrice: putLTP - Math.random() * 2,
      putAskPrice: putLTP + Math.random() * 2,
      putAskQty: Math.floor(10 + Math.random() * 100),
    });
  }

  // Sort options by strike price
  options.sort((a, b) => a.strikePrice - b.strikePrice);

  return {
    timestamp: new Date(),
    underlying: "NIFTY",
    underlyingValue,
    options,
  };
}

// Helper function to retry API calls with exponential backoff
async function retryApiCall<T>(
  apiCallFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCallFn();
    } catch (error) {
      lastError = error;
      console.log(
        `API call failed (attempt ${attempt + 1}/${maxRetries}):`,
        error instanceof Error ? error.message : "Unknown error"
      );

      // Wait with exponential backoff before retrying
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError;
}

// Extend the timeout for Vercel serverless functions (requires Vercel Pro plan)
export const maxDuration = 60; // 60 seconds

export async function GET() {
  try {
    console.log("Starting NSE option chain data scraping...");

    // Create an axios instance with specific configurations
    const axiosInstance = axios.create({
      timeout: 30000, // 30 second timeout
      maxRedirects: 5,
      withCredentials: true, // Important for cookie handling
    });

    // Step 1: Visit the main NSE page to get initial cookies
    console.log("Step 1: Visiting main NSE page to get cookies...");
    const mainPageResponse = await retryApiCall(
      () =>
        axiosInstance.get("https://www.nseindia.com", {
          headers: getNSEHeaders(),
        }),
      5, // Increase max retries
      1000 // Initial delay of 1 second
    );

    // Extract cookies from the response
    const cookies = mainPageResponse.headers["set-cookie"];
    const cookieString = cookies ? cookies.join("; ") : "";

    if (!cookieString) {
      console.warn("No cookies received from main page visit");
    } else {
      console.log("Cookies received successfully");
    }

    // Create headers with cookies for subsequent requests
    const headersWithCookies = {
      ...getNSEHeaders(),
      Cookie: cookieString,
      Referer: "https://www.nseindia.com/",
    };

    // Step 2: Visit the option chain page to get additional cookies
    console.log("Step 2: Visiting option chain page...");
    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 1000)
    );

    const optionChainPageResponse = await retryApiCall(
      () =>
        axiosInstance.get("https://www.nseindia.com/option-chain", {
          headers: headersWithCookies,
        }),
      3,
      1500
    );

    // Update cookies with any new ones from the option chain page
    const optionChainCookies = optionChainPageResponse.headers["set-cookie"];
    let updatedCookieString = cookieString;

    if (optionChainCookies) {
      updatedCookieString = [...(cookies || []), ...optionChainCookies].join(
        "; "
      );
      console.log("Additional cookies received from option chain page");
    }

    // Update headers with all cookies
    const finalHeaders = {
      ...getNSEHeaders(),
      Cookie: updatedCookieString,
      Referer: "https://www.nseindia.com/option-chain",
    };

    // Step 3: Wait a bit with random delay to mimic human behavior
    const randomDelay = 2000 + Math.floor(Math.random() * 2000);
    console.log(`Step 3: Waiting ${randomDelay}ms before API request...`);
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    // Step 4: Now fetch the option chain data from the NSE API
    console.log("Step 4: Fetching option chain data...");
    const apiResponse = await retryApiCall(
      () =>
        axiosInstance.get(
          "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY",
          {
            headers: finalHeaders,
          }
        ),
      4, // Increase max retries
      2000 // Initial delay of 2 seconds
    );

    // Step 5: Parse and validate the response data
    console.log("Step 5: Parsing and validating response data...");
    const nseData = apiResponse.data;

    // Log response structure for debugging
    console.log("Response structure:", {
      hasRecords: !!nseData?.records,
      hasFiltered: !!nseData?.filtered,
      expiryDatesCount: nseData?.records?.expiryDates?.length || 0,
      filteredDataCount: nseData?.filtered?.data?.length || 0,
      underlyingValue: nseData?.records?.underlyingValue,
    });

    if (!nseData || !nseData.records || !nseData.filtered) {
      throw new Error(
        "Invalid response format from NSE API: Missing required data structures"
      );
    }

    if (
      !nseData.records.expiryDates ||
      nseData.records.expiryDates.length === 0
    ) {
      throw new Error(
        "Invalid response format from NSE API: No expiry dates found"
      );
    }

    if (!nseData.filtered.data || nseData.filtered.data.length === 0) {
      throw new Error(
        "Invalid response format from NSE API: No option data found"
      );
    }

    // Extract the current NIFTY value
    const underlyingValue = nseData.records.underlyingValue || 0;
    const timestamp = new Date();

    // Process option chain data
    const options: OptionData[] = [];

    // Get the expiry dates (we'll use the nearest one)
    const expiryDates = nseData.records.expiryDates || [];
    const nearestExpiry = expiryDates.length > 0 ? expiryDates[0] : "";
    console.log(`Using nearest expiry date: ${nearestExpiry}`);

    // Filter options for the nearest expiry date
    const filteredData = nseData.filtered.data || [];
    console.log(`Total options data points: ${filteredData.length}`);

    // Count how many items match the nearest expiry
    const matchingExpiryCount = filteredData.filter(
      (item: { expiryDate: string }) => item.expiryDate === nearestExpiry
    ).length;
    console.log(`Options matching nearest expiry: ${matchingExpiryCount}`);

    for (const item of filteredData) {
      if (item.expiryDate === nearestExpiry) {
        const strikePrice = item.strikePrice;

        // Extract call option data
        const callOption = item.CE || {};
        // Extract put option data
        const putOption = item.PE || {};

        options.push({
          strikePrice,
          expiryDate: nearestExpiry,

          // Call options data
          callOI: callOption.openInterest || 0,
          callChangeInOI: callOption.changeinOpenInterest || 0,
          callVolume: callOption.totalTradedVolume || 0,
          callIV: callOption.impliedVolatility || 0,
          callLTP: callOption.lastPrice || 0,
          callNetChange: callOption.change || 0,
          callBidQty: callOption.bidQty || 0,
          callBidPrice: callOption.bidprice || 0,
          callAskPrice: callOption.askPrice || 0,
          callAskQty: callOption.askQty || 0,

          // Put options data
          putOI: putOption.openInterest || 0,
          putChangeInOI: putOption.changeinOpenInterest || 0,
          putVolume: putOption.totalTradedVolume || 0,
          putIV: putOption.impliedVolatility || 0,
          putLTP: putOption.lastPrice || 0,
          putNetChange: putOption.change || 0,
          putBidQty: putOption.bidQty || 0,
          putBidPrice: putOption.bidprice || 0,
          putAskPrice: putOption.askPrice || 0,
          putAskQty: putOption.askQty || 0,
        });
      }
    }

    if (options.length === 0) {
      throw new Error("No option data found for the nearest expiry date");
    }

    // Sort options by strike price
    options.sort((a, b) => a.strikePrice - b.strikePrice);
    console.log(`Processed ${options.length} option chain entries`);

    // Create the final data object
    const optionChainData: OptionChainData = {
      timestamp,
      underlying: "NIFTY",
      underlyingValue,
      options,
    };

    // Step 6: Store the real data in Firestore
    console.log("Step 6: Storing data in Firestore...");
    const docRef = await addDoc(collection(db, "optionChainData"), {
      ...optionChainData,
      timestamp: serverTimestamp(),
    });

    console.log(
      `NSE option chain data scraped and stored successfully with ID: ${docRef.id}`
    );

    return NextResponse.json({
      message: "NSE option chain data scraped and stored successfully",
      data: optionChainData,
    });
  } catch (error) {
    console.error("Error scraping option chain data:", error);

    // Log detailed error information
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "No stack trace";

    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      time: new Date().toISOString(),
    });

    // Try to get the latest real data from Firestore before falling back to mock data
    try {
      console.log(
        "Attempting to retrieve the latest real data from Firestore..."
      );

      // Query for the latest non-mock data
      const q = query(
        collection(db, "optionChainData"),
        // We could filter out mock data, but we'll check it in code instead
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        // Check if this is real data (not mock)
        if (!data.isMockData) {
          console.log(
            "Found recent real data in Firestore, using that instead of mock data"
          );

          // Convert Firestore timestamp to JavaScript Date
          const realData = {
            ...data,
            timestamp: data.timestamp.toDate(),
          };

          return NextResponse.json({
            message: "Using recent real data from database (scraping failed)",
            data: realData,
            error: errorMessage,
            isRecentData: true,
          });
        }
      }
    } catch (dbError) {
      console.error("Error retrieving data from Firestore:", dbError);
    }

    // If we couldn't get recent real data, fall back to mock data
    console.log("Falling back to mock data due to scraping error");
    const mockData = generateMockOptionChainData();

    // Store the mock data in Firestore with error information
    const mockDocRef = await addDoc(collection(db, "optionChainData"), {
      ...mockData,
      timestamp: serverTimestamp(),
      isMockData: true, // Flag to indicate this is mock data
      error: errorMessage,
      errorTime: new Date().toISOString(),
    });

    console.log(`Mock data stored with ID: ${mockDocRef.id}`);

    return NextResponse.json(
      {
        message: "Failed to scrape real data, using mock data as fallback",
        data: mockData,
        error: errorMessage,
        isMockData: true,
      },
      { status: 200 }
    ); // Still return 200 since we're providing fallback data
  }
}
