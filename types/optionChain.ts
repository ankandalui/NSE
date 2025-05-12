// Types for Option Chain data

export interface OptionData {
  strikePrice: number;
  expiryDate: string;

  // Call options data
  callOI: number;
  callChangeInOI: number;
  callVolume: number;
  callIV: number;
  callLTP: number;
  callNetChange: number;
  callBidQty: number;
  callBidPrice: number;
  callAskPrice: number;
  callAskQty: number;

  // Put options data
  putOI: number;
  putChangeInOI: number;
  putVolume: number;
  putIV: number;
  putLTP: number;
  putNetChange: number;
  putBidQty: number;
  putBidPrice: number;
  putAskPrice: number;
  putAskQty: number;
}

export interface OptionChainData {
  timestamp: Date;
  underlying: string;
  underlyingValue: number;
  options: OptionData[];
  isMockData?: boolean; // Flag to indicate if this is mock data
  error?: string; // Error message if scraping failed
  errorTime?: string; // Timestamp when the error occurred
  isRecentData?: boolean; // Flag to indicate if this is recent data from the database
}
