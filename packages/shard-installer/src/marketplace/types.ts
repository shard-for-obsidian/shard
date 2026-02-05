export interface MarketplacePlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}

export interface MarketplaceIndex {
  plugins: MarketplacePlugin[];
}

export interface CachedMarketplaceData {
  plugins: MarketplacePlugin[];
  fetchedAt: number;
}
