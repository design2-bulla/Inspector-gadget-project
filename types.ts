

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
  ANALYZING = 'ANALYZING',
  VALIDATING = 'VALIDATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ValidationHistoryItem {
  id: string;
  sku: string;
  timestamp: number;
  thumbnail: string;
}