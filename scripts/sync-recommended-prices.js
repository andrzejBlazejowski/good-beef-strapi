'use strict';

async function syncRecommendedPrices() {
  const result = await strapi
    .service('api::recommended-product.recommended-product')
    .syncPricesFromShop();

  console.log(
    `Price sync finished: updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`
  );

  if (result.errors.length > 0) {
    console.error('Failures:');
    for (const error of result.errors) {
      console.error(`- ${error.title} (${error.shopUrl}): ${error.message}`);
    }
  }

  if (result.failed > 0) {
    throw new Error(`Price sync completed with ${result.failed} failure(s)`);
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
    await syncRecommendedPrices();
  } finally {
    await app.destroy();
    process.exit(process.exitCode || 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
