"use client";

import { useState } from "react";
import { OptionChainData, OptionData } from "@/types/optionChain";
import LoadingSpinner from "./LoadingSpinner";

interface OptionChainTableProps {
  data: OptionChainData | null;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export default function OptionChainTable({
  data,
  isLoading,
  lastUpdated,
}: OptionChainTableProps) {
  const [sortField, setSortField] = useState<keyof OptionData | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof OptionData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedOptions = data?.options
    ? [...data.options].sort((a, b) => {
        if (!sortField) return 0;

        const aValue = a[sortField];
        const bValue = b[sortField];

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        }

        return 0;
      })
    : [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="text-center p-8">
        <p className="text-lg text-gray-600">
          No option chain data available. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-xs">CE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-xs">PE</span>
          </div>
          <div className="text-xs text-gray-600">
            Last Updated:{" "}
            {lastUpdated ? new Date(lastUpdated).toLocaleString() : "N/A"}
          </div>
        </div>
        <div className="flex gap-4">
          <button className="px-3 py-1 bg-blue-500 text-white text-xs rounded">
            View Chart
          </button>
          <button className="px-3 py-1 bg-gray-200 text-gray-800 text-xs rounded">
            Download
          </button>
        </div>
      </div>

      <table className="option-chain-table">
        <thead>
          <tr>
            <th colSpan={10} className="call-header">
              CALLS
            </th>
            <th>STRIKE PRICE</th>
            <th colSpan={10} className="put-header">
              PUTS
            </th>
          </tr>
          <tr>
            {/* Call Option Headers */}
            <th className="call-header" onClick={() => handleSort("callOI")}>
              OI
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callChangeInOI")}
            >
              Chng in OI
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callVolume")}
            >
              Volume
            </th>
            <th className="call-header" onClick={() => handleSort("callIV")}>
              IV
            </th>
            <th className="call-header" onClick={() => handleSort("callLTP")}>
              LTP
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callNetChange")}
            >
              Net Chng
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callBidQty")}
            >
              Bid Qty
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callBidPrice")}
            >
              Bid Price
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callAskPrice")}
            >
              Ask Price
            </th>
            <th
              className="call-header"
              onClick={() => handleSort("callAskQty")}
            >
              Ask Qty
            </th>

            {/* Strike Price */}
            <th onClick={() => handleSort("strikePrice")}>Strike Price</th>

            {/* Put Option Headers */}
            <th className="put-header" onClick={() => handleSort("putOI")}>
              OI
            </th>
            <th
              className="put-header"
              onClick={() => handleSort("putChangeInOI")}
            >
              Chng in OI
            </th>
            <th className="put-header" onClick={() => handleSort("putVolume")}>
              Volume
            </th>
            <th className="put-header" onClick={() => handleSort("putIV")}>
              IV
            </th>
            <th className="put-header" onClick={() => handleSort("putLTP")}>
              LTP
            </th>
            <th
              className="put-header"
              onClick={() => handleSort("putNetChange")}
            >
              Net Chng
            </th>
            <th className="put-header" onClick={() => handleSort("putBidQty")}>
              Bid Qty
            </th>
            <th
              className="put-header"
              onClick={() => handleSort("putBidPrice")}
            >
              Bid Price
            </th>
            <th
              className="put-header"
              onClick={() => handleSort("putAskPrice")}
            >
              Ask Price
            </th>
            <th className="put-header" onClick={() => handleSort("putAskQty")}>
              Ask Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedOptions.map((option, index) => {
            // Determine if options are in-the-money
            const isCallInTheMoney = option.strikePrice < data.underlyingValue;
            const isPutInTheMoney = option.strikePrice > data.underlyingValue;

            // Create class names for the row
            const rowClasses = [
              index % 2 === 0 ? "even" : "odd",
              isCallInTheMoney ? "in-the-money-call" : "",
              isPutInTheMoney ? "in-the-money-put" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <tr key={index} className={rowClasses}>
                {/* Call Option Data */}
                <td className="call-cell">{option.callOI.toLocaleString()}</td>
                <td
                  className={
                    option.callChangeInOI > 0
                      ? "call-cell positive-value"
                      : option.callChangeInOI < 0
                      ? "call-cell negative-value"
                      : "call-cell"
                  }
                >
                  {option.callChangeInOI.toLocaleString()}
                </td>
                <td className="call-cell">
                  {option.callVolume.toLocaleString()}
                </td>
                <td className="call-cell">{option.callIV.toFixed(2)}%</td>
                <td className="call-cell">{option.callLTP.toFixed(2)}</td>
                <td
                  className={
                    option.callNetChange > 0
                      ? "call-cell positive-value"
                      : option.callNetChange < 0
                      ? "call-cell negative-value"
                      : "call-cell"
                  }
                >
                  {option.callNetChange.toFixed(2)}
                </td>
                <td className="call-cell">
                  {option.callBidQty.toLocaleString()}
                </td>
                <td className="call-cell">{option.callBidPrice.toFixed(2)}</td>
                <td className="call-cell">{option.callAskPrice.toFixed(2)}</td>
                <td className="call-cell">
                  {option.callAskQty.toLocaleString()}
                </td>

                {/* Strike Price */}
                <td className="strike-price">
                  {option.strikePrice.toLocaleString()}
                </td>

                {/* Put Option Data */}
                <td className="put-cell">{option.putOI.toLocaleString()}</td>
                <td
                  className={
                    option.putChangeInOI > 0
                      ? "put-cell positive-value"
                      : option.putChangeInOI < 0
                      ? "put-cell negative-value"
                      : "put-cell"
                  }
                >
                  {option.putChangeInOI.toLocaleString()}
                </td>
                <td className="put-cell">
                  {option.putVolume.toLocaleString()}
                </td>
                <td className="put-cell">{option.putIV.toFixed(2)}%</td>
                <td className="put-cell">{option.putLTP.toFixed(2)}</td>
                <td
                  className={
                    option.putNetChange > 0
                      ? "put-cell positive-value"
                      : option.putNetChange < 0
                      ? "put-cell negative-value"
                      : "put-cell"
                  }
                >
                  {option.putNetChange.toFixed(2)}
                </td>
                <td className="put-cell">
                  {option.putBidQty.toLocaleString()}
                </td>
                <td className="put-cell">{option.putBidPrice.toFixed(2)}</td>
                <td className="put-cell">{option.putAskPrice.toFixed(2)}</td>
                <td className="put-cell">
                  {option.putAskQty.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
