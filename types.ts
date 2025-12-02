

export interface ExtractedProductRaw {
  sku: string;
  priceOnArt?: number; // Price found visually on the image next to the SKU
}

export interface ExtractedSkuResult {
  products: ExtractedProductRaw[]; 
}

export interface NoveyProductDetails {
  found: boolean;
  title?: string;
  price?: string; // This will be the current/sale price string from web
  regularPrice?: string; // This is the price before discount
  imageUrl?: string; 
  url?: string;
  description?: string;
  skuSuggestion?: string; // Suggestion if SKU format is wrong (e.g. missing hyphen)
}

export interface ProductResultItem {
  sku: string;
  priceOnArt?: number; // The visual price detected by AI
  details: NoveyProductDetails;
}

export interface SpellingCorrection {
  original: string;
  suggestion: string;
  context?: string; 
}

export interface SpellingAnalysis {
  hasErrors: boolean;
  corrections: SpellingCorrection[];
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING', // New state for batch processing
  ERROR = 'ERROR'
}

// New Interface for Batch Items
export type BatchItemStatus = 'PENDING' | 'ANALYZING' | 'VALIDATING' | 'COMPLETED' | 'ERROR';

export interface BatchAnalysisItem {
  id: string;
  fileBase64: string;
  mimeType: string;
  fileName: string;
  status: BatchItemStatus;
  results: ProductResultItem[];
  spellingResult: SpellingAnalysis | null;
  errorMsg?: string;
}

export interface ValidationHistoryItem {
  id: string;
  sku: string;
  timestamp: number;
  thumbnail: string;
}