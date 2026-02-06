// Re-export types from shard-installer package
export type {
	MarketplacePlugin,
	MarketplaceIndex as BaseMarketplaceIndex
} from '../../../../../packages/shard-installer/src/marketplace/types';

// Extended type for marketplace with generation timestamp
export interface MarketplaceIndex extends BaseMarketplaceIndex {
	generatedAt?: string;
}
