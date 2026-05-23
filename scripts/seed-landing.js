'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const landing = require('../data/landing.json');

const LANDING_IMAGES_DIR = path.join('goodbeef-landing-page', 'assets', 'images');

const COLLECTION_TYPES = [
  'slider-slide',
  'feature',
  'info-article',
  'recommended-product',
  'gastronomy-product',
  'faq-item',
  'meat-category',
  'stat-counter',
  'contact-info-box',
];

const SINGLE_TYPES = [
  'home-page-meta',
  'site-header',
  'home-about',
  'info-section',
  'recommended-products-section',
  'gastronomy-section',
  'faq-section',
  'meat-categories-section',
  'contact-cta',
  'footer',
];

const PUBLIC_PERMISSIONS = {
  'home-page-meta': ['find'],
  'site-header': ['find'],
  'home-about': ['find'],
  'info-section': ['find'],
  'recommended-products-section': ['find'],
  'gastronomy-section': ['find'],
  'faq-section': ['find'],
  'meat-categories-section': ['find'],
  'contact-cta': ['find'],
  footer: ['find'],
  'slider-slide': ['find', 'findOne'],
  feature: ['find', 'findOne'],
  'info-article': ['find', 'findOne'],
  'recommended-product': ['find', 'findOne'],
  'gastronomy-product': ['find', 'findOne'],
  'faq-item': ['find', 'findOne'],
  'meat-category': ['find', 'findOne'],
  'stat-counter': ['find', 'findOne'],
  'contact-info-box': ['find', 'findOne'],
};

function uid(model) {
  return `api::${model}.${model}`;
}

function getFileSizeInBytes(filePath) {
  return fs.statSync(filePath).size;
}

function getLandingFileData(relativePath) {
  const filePath = path.join(LANDING_IMAGES_DIR, relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Landing image not found: ${filePath}`);
  }

  const fileName = path.basename(relativePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size: getFileSizeInBytes(filePath),
    mimetype: mimeType,
  };
}

async function uploadLandingFile(relativePath, altText) {
  const fileData = getLandingFileData(relativePath);
  const name = path.basename(relativePath, path.extname(relativePath));

  const existing = await strapi.query('plugin::upload.file').findOne({
    where: { name },
  });

  if (existing) {
    return existing;
  }

  const [file] = await strapi.plugin('upload').service('upload').upload({
    files: fileData,
    data: {
      fileInfo: {
        alternativeText: altText || name,
        caption: name,
        name,
      },
    },
  });

  return file;
}

async function mediaId(relativePath, altText) {
  if (!relativePath) {
    return undefined;
  }

  try {
    const file = await uploadLandingFile(relativePath, altText);
    return file.id;
  } catch (error) {
    console.warn(`Skipping image "${relativePath}": ${error.message}`);
    return undefined;
  }
}

async function clearCollection(model) {
  const documentUid = uid(model);
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const response = await strapi.documents(documentUid).findMany({
      page,
      pageSize: 100,
    });

    pageCount = response.pagination?.pageCount || 1;

    for (const doc of response.results || []) {
      await strapi.documents(documentUid).delete({ documentId: doc.documentId });
    }

    page += 1;
  }
}

async function createCollectionEntry(model, data) {
  await strapi.documents(uid(model)).create({
    data: {
      ...data,
      publishedAt: new Date().toISOString(),
    },
    status: 'published',
  });
}

async function upsertSingleType(model, data) {
  const documentUid = uid(model);
  const existing = await strapi.documents(documentUid).findFirst();

  if (existing) {
    await strapi.documents(documentUid).update({
      documentId: existing.documentId,
      data,
    });
    return;
  }

  await strapi.documents(documentUid).create({ data });
}

async function setPublicPermissions(permissions) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  const tasks = [];

  for (const [controller, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      const actionName = `api::${controller}.${controller}.${action}`;

      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action: actionName,
          role: publicRole.id,
        },
      });

      if (!existing) {
        tasks.push(
          strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: actionName,
              role: publicRole.id,
            },
          })
        );
      }
    }
  }

  await Promise.all(tasks);
}

async function clearLandingCollections() {
  for (const model of COLLECTION_TYPES) {
    await clearCollection(model);
  }
}

async function importHomePageMeta() {
  await upsertSingleType('home-page-meta', landing.homePageMeta);
}

async function importSiteHeader() {
  const logoId = await mediaId(landing.siteHeader.logo, landing.siteHeader.logoAlt);

  await upsertSingleType('site-header', {
    ...landing.siteHeader,
    logo: logoId,
  });
}

async function importSliderSlides() {
  for (const slide of landing.sliderSlides) {
    const imageId = await mediaId(slide.image);

    await createCollectionEntry('slider-slide', {
      title: slide.title,
      order: slide.order,
      image: imageId,
    });
  }
}

async function importFeatures() {
  for (const feature of landing.features) {
    await createCollectionEntry('feature', feature);
  }
}

async function importHomeAbout() {
  const mainImageId = await mediaId(
    landing.homeAbout.mainImage,
    landing.homeAbout.mainImageAlt
  );

  await upsertSingleType('home-about', {
    ...landing.homeAbout,
    mainImage: mainImageId,
  });
}

async function importInfoSection() {
  await upsertSingleType('info-section', landing.infoSection);
}

async function importInfoArticles() {
  for (const article of landing.infoArticles) {
    const imageId = await mediaId(article.image, article.imageAlt);

    await createCollectionEntry('info-article', {
      title: article.title,
      content: article.content,
      imageAlt: article.imageAlt,
      order: article.order,
      image: imageId,
    });
  }
}

async function importRecommendedProductsSection() {
  await upsertSingleType('recommended-products-section', landing.recommendedProductsSection);
}

async function importRecommendedProducts() {
  for (const product of landing.recommendedProducts) {
    const imageId = await mediaId(product.image, product.imageAlt);

    await createCollectionEntry('recommended-product', {
      title: product.title,
      priceLabel: product.priceLabel,
      shopUrl: product.shopUrl,
      imageAlt: product.imageAlt,
      order: product.order,
      buyButtonLabel: 'Kup teraz',
      showBuyButton: true,
      image: imageId,
    });
  }
}

async function importGastronomySection() {
  await upsertSingleType('gastronomy-section', landing.gastronomySection);
}

async function importGastronomyProducts() {
  for (const product of landing.gastronomyProducts) {
    await createCollectionEntry('gastronomy-product', product);
  }
}

async function importFaqSection() {
  const mainImageId = await mediaId(
    landing.faqSection.mainImage,
    landing.faqSection.mainImageAlt
  );
  const overlayImageId = await mediaId(
    landing.faqSection.overlayImage,
    landing.faqSection.overlayImageAlt
  );

  await upsertSingleType('faq-section', {
    ...landing.faqSection,
    mainImage: mainImageId,
    overlayImage: overlayImageId,
  });
}

async function importFaqItems() {
  for (const item of landing.faqItems) {
    await createCollectionEntry('faq-item', item);
  }
}

async function importMeatCategoriesSection() {
  await upsertSingleType('meat-categories-section', landing.meatCategoriesSection);
}

async function importMeatCategories() {
  for (const category of landing.meatCategories) {
    const imageId = await mediaId(category.image, category.imageAlt);

    await createCollectionEntry('meat-category', {
      title: category.title,
      subtitle: category.subtitle,
      link: category.link,
      imageAlt: category.imageAlt,
      order: category.order,
      image: imageId,
    });
  }
}

async function importStatCounters() {
  for (const counter of landing.statCounters) {
    await createCollectionEntry('stat-counter', counter);
  }
}

async function importContactCta() {
  const backgroundImageId = await mediaId(landing.contactCta.backgroundImage);

  await upsertSingleType('contact-cta', {
    ...landing.contactCta,
    backgroundImage: backgroundImageId,
  });
}

async function importContactInfoBoxes() {
  for (const box of landing.contactInfoBoxes) {
    await createCollectionEntry('contact-info-box', box);
  }
}

async function importFooter() {
  await upsertSingleType('footer', landing.footer);
}

async function seedLandingPage() {
  console.log('Clearing existing landing page entries...');
  await clearLandingCollections();

  console.log('Setting public API permissions...');
  await setPublicPermissions(PUBLIC_PERMISSIONS);

  console.log('Importing landing page content...');
  await importHomePageMeta();
  await importSiteHeader();
  await importSliderSlides();
  await importFeatures();
  await importHomeAbout();
  await importInfoSection();
  await importInfoArticles();
  await importRecommendedProductsSection();
  await importRecommendedProducts();
  await importGastronomySection();
  await importGastronomyProducts();
  await importFaqSection();
  await importFaqItems();
  await importMeatCategoriesSection();
  await importMeatCategories();
  await importStatCounters();
  await importContactCta();
  await importContactInfoBoxes();
  await importFooter();

  console.log('Landing page seed completed successfully.');
}

module.exports = { seedLandingPage };

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  try {
    await seedLandingPage();
  } catch (error) {
    console.error('Landing seed failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.destroy();
    process.exit(process.exitCode || 0);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
