"use client";

import { useState, useEffect } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import OptionChainTable from "@/components/OptionChainTable";
import {
  fetchLatestOptionChainData,
  triggerOptionChainScrape,
} from "@/lib/fetchOptionChainData";
import { OptionChainData } from "@/types/optionChain";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable SSR for queries to prevent hydration mismatches
      suspense: false,
    },
  },
});

// Component to handle client-side only rendering
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <>{children}</>;
}

function OptionChainApp() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Query to fetch the latest option chain data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["optionChainData"],
    queryFn: fetchLatestOptionChainData,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 4 * 60 * 1000, // Consider data stale after 4 minutes
  });

  // State to track scraping errors
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Trigger a scrape when the component mounts
  useEffect(() => {
    const scrapeData = async () => {
      try {
        console.log("Initiating data scrape at:", new Date().toLocaleString());
        setScrapeError(null); // Clear any previous errors
        await triggerOptionChainScrape();
        console.log("Data scrape completed successfully");
        refetch();
      } catch (error) {
        console.error("Error scraping data:", error);
        setScrapeError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      }
    };

    scrapeData();

    // Set up an interval to scrape data every 5 minutes
    const intervalId = setInterval(() => {
      console.log("5-minute interval triggered, scraping new data...");
      scrapeData();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [refetch]);

  // Update the last updated timestamp when data changes
  useEffect(() => {
    if (data) {
      setLastUpdated(new Date());
      console.log("Data refreshed at:", new Date().toLocaleString());
    }
  }, [data]);

  // State for countdown timer
  const [countdown, setCountdown] = useState<string>("5:00");

  // Countdown timer for next refresh
  useEffect(() => {
    let timeLeft = 5 * 60; // 5 minutes in seconds

    const updateCountdown = () => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      setCountdown(`${minutes}:${seconds.toString().padStart(2, "0")}`);

      if (timeLeft === 0) {
        timeLeft = 5 * 60; // Reset to 5 minutes
        console.log("Auto-refresh timer completed, refreshing data...");
      } else {
        timeLeft -= 1;
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      console.log("Manual refresh triggered at:", new Date().toLocaleString());
      setScrapeError(null); // Clear any previous errors
      await triggerOptionChainScrape();
      console.log("Manual refresh completed successfully");

      // Reset the countdown timer
      setCountdown("5:00");

      refetch();
    } catch (error) {
      console.error("Error refreshing data:", error);
      setScrapeError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  };

  if (error || scrapeError) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-red-600">
          {scrapeError
            ? `Error scraping data: ${scrapeError}`
            : "Error loading option chain data."}
        </p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 text-black dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <div className="nse-header">
          <div className="nse-logo">
            <span className="font-bold text-sm">NSE</span>
          </div>
          <h1>Option Chain (Equity Derivatives)</h1>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Refreshing...
            </>
          ) : (
            "Refresh Data"
          )}
        </button>
      </div>

      {/* Auto-refresh indicator */}
      <div className="mb-4 flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            Auto-refreshes every 5 minutes
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Next refresh: <span>{countdown}</span>
        </div>
      </div>

      {/* Mock data warning */}
      {data?.isMockData && (
        <div className="mb-4 p-2 border border-red-300 rounded bg-red-50 text-red-800">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">
              Using mock data - Unable to fetch real-time NSE data
            </span>
          </div>
          <p className="text-xs mt-1">
            The application is currently using simulated data because it
            couldn&apos;t connect to NSE&apos;s servers. This may be due to
            network issues or NSE&apos;s anti-scraping measures.
          </p>
        </div>
      )}

      {/* Underlying Value */}
      {data && (
        <div className="mb-4 p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <div className="underlying-value">
            <span>
              {data.underlying} {data.underlyingValue.toFixed(2)}
            </span>
            {/* This would normally come from the API, but for now we'll use a placeholder */}
            <span className={data.isMockData ? "value-neutral" : "value-up"}>
              {data.isMockData ? (
                <span>(Real-time data unavailable)</span>
              ) : (
                <>
                  <span className="arrow-up"></span>
                  <span>+60.90 (+0.25%)</span>
                </>
              )}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            As on {lastUpdated ? lastUpdated.toLocaleString() : "N/A"}
            {data.isMockData && " (Mock Data)"}
          </div>
        </div>
      )}

      <OptionChainTable
        data={data as OptionChainData | null}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
      />
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientOnly>
        {/* Add NotificationHandler component */}
        <div>
          <OptionChainApp />
          {/* We'll dynamically import the NotificationHandler to avoid SSR issues */}
          {typeof window !== "undefined" && (
            <div id="notification-container" className="hidden">
              {/* This will be populated client-side */}
            </div>
          )}
        </div>
      </ClientOnly>
    </QueryClientProvider>
  );
}
