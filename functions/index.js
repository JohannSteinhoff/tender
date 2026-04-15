const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const KROGER_CLIENT_ID = defineSecret("KROGER_CLIENT_ID");
const KROGER_CLIENT_SECRET = defineSecret("KROGER_CLIENT_SECRET");

const BASE_URL = "https://api-ce.kroger.com/v1";

// Separate token caches per scope — Locations needs no scope, Products needs product.compact
const tokenCaches = {};

async function getKrogerToken(clientId, clientSecret, scope = "") {
  const cache = tokenCaches[scope] || { token: null, expiresAt: 0 };
  if (cache.token && Date.now() < cache.expiresAt) {
    return cache.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = scope
    ? `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
    : "grant_type=client_credentials";

  const response = await fetch(`${BASE_URL}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kroger auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  tokenCaches[scope] = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCaches[scope].token;
}

exports.findKrogerLocation = onCall(
  { secrets: [KROGER_CLIENT_ID, KROGER_CLIENT_SECRET] },
  async (request) => {
    const { zipCode, chain } = request.data;
    if (!zipCode) throw new Error("zipCode is required");

    // Locations API requires no scope
    const token = await getKrogerToken(
      KROGER_CLIENT_ID.value(),
      KROGER_CLIENT_SECRET.value(),
      ""
    );

    const url = new URL(`${BASE_URL}/locations`);
    url.searchParams.set("filter.zipCode", zipCode);
    if (chain) url.searchParams.set("filter.chain", chain);
    url.searchParams.set("filter.limit", "1");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kroger locations API failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    const location = data.data?.[0];
    if (!location) return null;

    return {
      locationId: location.locationId,
      name: location.name,
      address: location.address?.addressLine1 ?? null,
    };
  }
);

exports.getKrogerPrices = onCall(
  { secrets: [KROGER_CLIENT_ID, KROGER_CLIENT_SECRET] },
  async (request) => {
    const { items, locationId } = request.data;
    if (!Array.isArray(items) || !locationId) {
      throw new Error("items array and locationId are required");
    }

    // Products API requires product.compact scope
    const token = await getKrogerToken(
      KROGER_CLIENT_ID.value(),
      KROGER_CLIENT_SECRET.value(),
      "product.compact"
    );

    const results = {};

    await Promise.all(
      items.map(async ({ id, name }) => {
        try {
          const url = new URL(`${BASE_URL}/products`);
          url.searchParams.set("filter.term", name);
          url.searchParams.set("filter.locationId", locationId);
          url.searchParams.set("filter.limit", "1");

          const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            results[id] = null;
            return;
          }

          const data = await response.json();
          const product = data.data?.[0];

          if (!product) {
            console.log(`[debug] no product found for: ${name}`);
            results[id] = null;
            return;
          }

          console.log(`[debug] ${name} → ${JSON.stringify(product.items?.[0]?.price)}`);

          const itemInfo = product.items?.[0];
          const priceInfo = itemInfo?.price;

          results[id] = {
            price: priceInfo?.regular ?? priceInfo?.promo ?? null,
            brand: product.brand || null,
            size: itemInfo?.size || null,
          };
        } catch {
          results[id] = null;
        }
      })
    );

    return results;
  }
);
