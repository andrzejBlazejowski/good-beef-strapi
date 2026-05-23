const JSON_LD_SCRIPT_REGEX =
  /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;

const DEFAULT_FETCH_OPTIONS: RequestInit = {
  headers: {
    Accept: 'text/html',
    'User-Agent': 'GoodBeef-Strapi-PriceSync/1.0',
  },
  signal: AbortSignal.timeout(30_000),
};

export function formatPriceLabel(pricePln: number): string {
  const rounded = Math.round(pricePln * 100) / 100;

  if (Number.isInteger(rounded)) {
    return `${rounded}zł/kg`;
  }

  const [intPart, decPart] = rounded.toFixed(2).split('.');
  return `${intPart},${decPart}zł/kg`;
}

export function parseProductPriceFromHtml(html: string): number | null {
  let match: RegExpExecArray | null;

  JSON_LD_SCRIPT_REGEX.lastIndex = 0;

  while ((match = JSON_LD_SCRIPT_REGEX.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());

      if (data?.['@type'] !== 'Product') {
        continue;
      }

      const price = data?.offers?.price;

      if (price === undefined || price === null || price === '') {
        continue;
      }

      const parsed = Number.parseFloat(String(price));

      if (!Number.isFinite(parsed) || parsed < 0) {
        continue;
      }

      return parsed;
    } catch {
      // Try the next JSON-LD block.
    }
  }

  return null;
}

export async function fetchPrestaShopProductPrice(
  shopUrl: string,
  fetchOptions: RequestInit = DEFAULT_FETCH_OPTIONS
): Promise<number> {
  const response = await fetch(shopUrl, fetchOptions);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${shopUrl}`);
  }

  const html = await response.text();
  const price = parseProductPriceFromHtml(html);

  if (price === null) {
    throw new Error(`Product price not found in JSON-LD for ${shopUrl}`);
  }

  return price;
}
