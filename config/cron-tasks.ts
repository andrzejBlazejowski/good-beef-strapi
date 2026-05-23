import type { Core } from '@strapi/strapi';

export default {
  syncRecommendedProductPrices: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await strapi
        .service('api::recommended-product.recommended-product')
        .syncPricesFromShop();
    },
    options: {
      // Every Sunday at 03:00 (Europe/Warsaw).
      rule: '0 0 3 * * 0',
      tz: 'Europe/Warsaw',
    },
  },
};
