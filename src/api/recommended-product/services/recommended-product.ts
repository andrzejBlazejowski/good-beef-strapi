import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

import {
  fetchPrestaShopProductPrice,
  formatPriceLabel,
} from '../../../services/prestashop-price';

const DOCUMENT_UID = 'api::recommended-product.recommended-product' as const;

type SyncResult = {
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ documentId: string; title: string; shopUrl: string; message: string }>;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RecommendedProductDocument = {
  documentId: string;
  title?: string;
  shopUrl?: string;
  priceLabel?: string;
  priceSyncedAt?: string;
};

async function findAllPublishedProducts(strapi: Core.Strapi) {
  return (await strapi.documents(DOCUMENT_UID).findMany({
    status: 'published',
  })) as RecommendedProductDocument[];
}

export default factories.createCoreService(DOCUMENT_UID, ({ strapi }) => ({
  async syncPricesFromShop(options: { requestDelayMs?: number } = {}): Promise<SyncResult> {
    const requestDelayMs = options.requestDelayMs ?? 500;
    const products = await findAllPublishedProducts(strapi);

    const result: SyncResult = {
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const [index, product] of products.entries()) {
      const shopUrl = product.shopUrl?.trim();
      const title = product.title || product.documentId;

      if (!shopUrl) {
        result.failed += 1;
        result.errors.push({
          documentId: product.documentId,
          title,
          shopUrl: shopUrl || '',
          message: 'Missing shopUrl',
        });
        continue;
      }

      try {
        const pricePln = await fetchPrestaShopProductPrice(shopUrl);
        const priceLabel = formatPriceLabel(pricePln);
        const syncedAt = new Date().toISOString();

        if (product.priceLabel === priceLabel && product.priceSyncedAt) {
          await strapi.documents(DOCUMENT_UID).update({
            documentId: product.documentId,
            data: { priceSyncedAt: syncedAt },
            status: 'published',
          });
          result.skipped += 1;
        } else {
          await strapi.documents(DOCUMENT_UID).update({
            documentId: product.documentId,
            data: {
              priceLabel,
              priceSyncedAt: syncedAt,
            },
            status: 'published',
          });
          result.updated += 1;
          strapi.log.info(
            `[price-sync] ${title}: ${product.priceLabel ?? '(none)'} -> ${priceLabel}`
          );
        }
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error);

        result.errors.push({
          documentId: product.documentId,
          title,
          shopUrl,
          message,
        });

        strapi.log.error(`[price-sync] Failed for ${title} (${shopUrl}): ${message}`);
      }

      if (index < products.length - 1 && requestDelayMs > 0) {
        await delay(requestDelayMs);
      }
    }

    strapi.log.info(
      `[price-sync] Done. updated=${result.updated} skipped=${result.skipped} failed=${result.failed}`
    );

    return result;
  },
}));
