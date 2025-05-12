import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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
  let lastError: any;

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

export async function GET() {
  try {
    console.log("Starting NSE option chain data scraping...");

    // First, we need to visit the main page to get cookies
    const mainPageResponse = await retryApiCall(
      () =>
        axios.get("https://www.nseindia.com", {
          headers: getNSEHeaders(),
        }),
      3, // Max 3 retries
      1000 // Initial delay of 1 second
    );

    // Extract cookies from the response
    const cookies = mainPageResponse.headers["set-cookie"];
    const cookieString = cookies ? cookies.join("; ") : "";

    // Create headers with cookies for the API request
    const headersWithCookies = {
      ...getNSEHeaders(),
      Cookie: cookieString,
    };

    // Wait a bit to avoid being detected as a bot
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Now fetch the option chain data from the NSE API with retry mechanism
    // We'll use the NIFTY index as default
    const apiResponse = await retryApiCall(
      () =>
        axios.get(
          "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY",
          {
            headers: headersWithCookies,
            timeout: 10000, // 10 second timeout
          }
        ),
      3, // Max 3 retries
      2000 // Initial delay of 2 seconds
    );

    // Parse the response data
    const nseData = apiResponse.data;

    if (!nseData || !nseData.records || !nseData.filtered) {
      throw new Error("Invalid response format from NSE API");
    }

    // Extract the current NIFTY value
    const underlyingValue = nseData.records.underlyingValue || 0;
    const timestamp = new Date();

    // Process option chain data
    const options: OptionData[] = [];

    // Get the expiry dates (we'll use the nearest one)
    const expiryDates = nseData.records.expiryDates || [];
    const nearestExpiry = expiryDates.length > 0 ? expiryDates[0] : "";

    // Filter options for the nearest expiry date
    const filteredData = nseData.filtered.data || [];

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

    // Sort options by strike price
    options.sort((a, b) => a.strikePrice - b.strikePrice);

    // Create the final data object
    const optionChainData: OptionChainData = {
      timestamp,
      underlying: "NIFTY",
      underlyingValue,
      options,
    };

    // Store the real data in Firestore
    await addDoc(collection(db, "optionChainData"), {
      ...optionChainData,
      timestamp: serverTimestamp(),
    });

    console.log("NSE option chain data scraped and stored successfully");

    return NextResponse.json({
      message: "NSE option chain data scraped and stored successfully",
      data: optionChainData,
    });
  } catch (error) {
    console.error("Error scraping option chain data:", error);

    // Fallback to mock data if scraping fails
    console.log("Falling back to mock data due to scraping error");
    const mockData = generateMockOptionChainData();

    // Store the mock data in Firestore
    await addDoc(collection(db, "optionChainData"), {
      ...mockData,
      timestamp: serverTimestamp(),
      isMockData: true, // Flag to indicate this is mock data
    });

    return NextResponse.json(
      {
        message: "Failed to scrape real data, using mock data as fallback",
        data: mockData,
        error: error instanceof Error ? error.message : "Unknown error",
        isMockData: true,
      },
      { status: 200 }
    ); // Still return 200 since we're providing fallback data
  }
}
