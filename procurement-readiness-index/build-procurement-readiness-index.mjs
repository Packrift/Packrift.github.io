import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(".");
const SOURCE = "/Users/farhan/Downloads/packrift-mc-analysis/products.json";
const SITE = "https://packrift.github.io/procurement-readiness-index";
const GENERATED_AT = new Date().toISOString();
const AGENT_MANIFEST_UPDATED_AT = "2026-05-31T19:22:56Z";
const MAX_SKU_PAGES = 1200;
const INDEXNOW_KEY = "7d4ea0e32d6f4924b35d7b8c4e3a95f1";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "item";

const ensureDir = (dir) => fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
const write = (file, content) => {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

const money = (price) => {
  if (!price?.amountMicros) return null;
  return Number(price.amountMicros) / 1_000_000;
};

const customValue = (item, name) =>
  item.customAttributes?.find((attr) => attr.name === name)?.value || "";

const cleanLink = (url = "") => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_content");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("country");
    parsed.searchParams.delete("currency");
    return parsed.toString();
  } catch {
    return url;
  }
};

const priceBand = (value) => {
  if (value == null) return "unknown";
  if (value < 25) return "under-25";
  if (value < 75) return "25-to-75";
  if (value < 200) return "75-to-200";
  return "200-plus";
};

const weightBand = (value) => {
  if (value == null) return "unknown";
  if (value < 1) return "sub-1-lb";
  if (value < 10) return "1-to-10-lb";
  if (value < 50) return "10-to-50-lb";
  return "50-plus-lb";
};

const typeLabel = (item) =>
  item.productAttributes?.productTypes?.[0] ||
  item.productAttributes?.customLabel0 ||
  "Uncategorized packaging";

const readinessScore = (row) => {
  let score = 20;
  if (row.in_stock) score += 20;
  if (row.has_gtin) score += 15;
  if (row.has_weight) score += 15;
  if (row.has_price) score += 15;
  if (row.has_product_url) score += 10;
  if (row.highlights.length >= 3) score += 5;
  return Math.min(score, 100);
};

const products = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

const rows = products
  .map((item) => {
    const attr = item.productAttributes || {};
    const sku = customValue(item, "sku");
    const priceValue = money(attr.price);
    const weight = attr.shippingWeight?.value == null ? null : Number(attr.shippingWeight.value);
    const row = {
      sku,
      title: attr.title || sku || "Packrift packaging SKU",
      description: attr.description || "",
      product_type: typeLabel(item),
      catalog_family: attr.customLabel0 || "packaging",
      url: cleanLink(attr.link || ""),
      availability: attr.availability || "UNKNOWN",
      in_stock: attr.availability === "IN_STOCK",
      sell_on_google_quantity: Number(attr.sellOnGoogleQuantity || 0),
      gtins: attr.gtins || [],
      has_gtin: Boolean(attr.gtins?.length),
      price_usd: priceValue,
      price_band: priceBand(priceValue),
      shipping_weight_lb: weight,
      weight_band: weightBand(weight),
      has_weight: weight != null,
      has_price: priceValue != null,
      has_product_url: Boolean(attr.link),
      highlights: attr.productHighlights || [],
      google_product_category: attr.googleProductCategory || "",
    };
    row.readiness_score = readinessScore(row);
    row.page_slug = `${slugify(sku)}-${slugify(row.title)}`.slice(0, 120);
    return row;
  })
  .filter((row) => row.sku && row.url && row.title)
  .sort((a, b) => {
    const stockDelta = Number(b.in_stock) - Number(a.in_stock);
    if (stockDelta) return stockDelta;
    return b.readiness_score - a.readiness_score || a.title.localeCompare(b.title);
  });

const publicRows = rows.slice(0, MAX_SKU_PAGES);

const byType = new Map();
const byBand = new Map();
for (const row of publicRows) {
  const typeSlug = slugify(row.product_type);
  if (!byType.has(typeSlug)) byType.set(typeSlug, { slug: typeSlug, label: row.product_type, rows: [] });
  byType.get(typeSlug).rows.push(row);

  const bandSlug = row.price_band;
  if (!byBand.has(bandSlug)) byBand.set(bandSlug, { slug: bandSlug, label: row.price_band, rows: [] });
  byBand.get(bandSlug).rows.push(row);
}

const stats = {
  generated_at: GENERATED_AT,
  source: "Packrift Merchant Center product export",
  source_file: SOURCE,
  total_source_products: products.length,
  eligible_rows: rows.length,
  published_sku_pages: publicRows.length,
  product_type_pages: byType.size,
  price_band_pages: byBand.size,
  in_stock_rows: publicRows.filter((row) => row.in_stock).length,
  rows_with_gtin: publicRows.filter((row) => row.has_gtin).length,
  rows_with_shipping_weight: publicRows.filter((row) => row.has_weight).length,
};

const css = `
:root { color-scheme: light; --ink:#17201a; --muted:#5f6b62; --line:#d8dfd6; --paper:#fbfcf8; --band:#eef4ed; --accent:#285f3a; --accent2:#8a4f23; }
* { box-sizing: border-box; }
body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); line-height:1.5; }
a { color:var(--accent); text-decoration-thickness: .08em; text-underline-offset: .18em; }
header { padding: 28px min(6vw, 56px) 24px; border-bottom:1px solid var(--line); background:#fff; }
main { padding: 28px min(6vw, 56px) 54px; max-width: 1180px; }
.kicker { text-transform:uppercase; color:var(--accent2); font-weight:700; font-size:12px; letter-spacing:.08em; }
h1 { font-size: clamp(30px, 5vw, 52px); line-height:1.02; margin: 8px 0 12px; letter-spacing:0; max-width:980px; }
h2 { font-size: 24px; margin: 34px 0 12px; letter-spacing:0; }
h3 { font-size: 18px; margin: 22px 0 8px; letter-spacing:0; }
p { max-width: 820px; color:var(--muted); }
.summary { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin:22px 0; max-width:980px; }
.metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fff; min-height:88px; }
.metric strong { display:block; font-size:25px; color:var(--ink); }
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:12px; }
.card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fff; }
.table-wrap { overflow:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
table { width:100%; border-collapse:collapse; font-size:14px; min-width:840px; }
th, td { padding:10px 12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
th { background:var(--band); color:#26352a; font-weight:700; }
.pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:2px 8px; margin:2px 4px 2px 0; background:#fff; font-size:12px; color:#334238; }
.score { font-weight:800; color:var(--accent); }
.note { border-left:4px solid var(--accent); padding:10px 14px; background:var(--band); color:#334238; max-width:880px; }
footer { padding: 24px min(6vw, 56px); border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
`;

const layout = ({ title, description, body, canonical, extraHead = "" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<style>${css}</style>
${extraHead}
</head>
<body>
<header>
<div class="kicker">Packrift public data asset</div>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
</header>
<main>${body}</main>
<footer>Packrift Procurement Readiness Index. Generated ${escapeHtml(GENERATED_AT)} from Packrift product feed fields suitable for public buyer and agent discovery. Cost data is excluded.</footer>
</body>
</html>`;

const productJsonLd = (row) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: row.title,
  sku: row.sku,
  brand: { "@type": "Brand", name: "Packrift" },
  gtin: row.gtins[0] || undefined,
  description: row.description,
  url: row.url,
  offers: {
    "@type": "Offer",
    availability: row.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    priceCurrency: "USD",
    price: row.price_usd == null ? undefined : row.price_usd.toFixed(2),
    url: row.url,
  },
});

const rowsTable = (items) => `<div class="table-wrap"><table>
<thead><tr><th>SKU</th><th>Product</th><th>Type</th><th>Readiness</th><th>Stock</th><th>Price band</th><th>Weight band</th></tr></thead>
<tbody>${items
  .map(
    (row) => `<tr>
<td><a href="/sku/${row.page_slug}/">${escapeHtml(row.sku)}</a></td>
<td>${escapeHtml(row.title)}</td>
<td>${escapeHtml(row.product_type)}</td>
<td class="score">${row.readiness_score}</td>
<td>${row.in_stock ? "In stock" : "Out of stock"}</td>
<td>${escapeHtml(row.price_band)}</td>
<td>${escapeHtml(row.weight_band)}</td>
</tr>`
  )
  .join("")}</tbody></table></div>`;

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Packrift Procurement Readiness Index",
  description:
    "A public Packrift catalog-derived readiness index for packaging procurement agents and B2B buyers. It summarizes product availability, GTIN presence, public product URLs, shipping weight, price bands, and product-type coverage.",
  url: SITE,
  creator: { "@type": "Organization", name: "Packrift", url: "https://packrift.com" },
  license: "https://packrift.com/policies/terms-of-service",
  dateModified: GENERATED_AT,
  distribution: [
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/readiness-index.json` },
    { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/readiness-index.csv` },
    { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${SITE}/data/readiness-index.jsonl` },
  ],
};

const agentManifest = () => {
  const representativeSku = publicRows[0]?.page_slug;
  const representativeType = [...byType.values()].sort((a, b) => b.rows.length - a.rows.length)[0]?.slug;
  return {
    spec_version: "agentmanifest-0.3",
    name: "Packrift Procurement Readiness Index",
    version: "1.0.1",
    description:
      "Packrift Procurement Readiness Index is a free, no-auth public reference asset for catalog-derived packaging procurement signals. It summarizes stock, GTIN, product URL, product type, public price band, shipping weight band, and readiness-score coverage for Packrift SKU records without exposing supplier cost, private customer data, or checkout commitments.",
    homepage: `${SITE}/`,
    documentation: `${SITE}/llms.txt`,
    categories: ["commerce", "logistics", "engineering", "computing"],
    primary_category: "reference",
    endpoints: [
      {
        path: "/llms.txt",
        method: "GET",
        description: "Fetch the compact agent-readable overview, source boundaries, and key public data routes.",
        parameters: [],
        response_description: "Plain text guide covering canonical URLs, data files, safe-use notes, and source boundaries.",
      },
      {
        path: "/openapi.json",
        method: "GET",
        description: "Fetch the OpenAPI map for public procurement-readiness data routes.",
        parameters: [],
        response_description: "OpenAPI 3.1 document for read-only readiness rows and release statistics.",
      },
      {
        path: "/sitemap.xml",
        method: "GET",
        description: "Enumerate crawlable procurement-readiness pages and machine-readable sidecars.",
        parameters: [],
        response_description: "XML sitemap with static support paths, SKU pages, product-type pages, and price-band pages.",
      },
      {
        path: "/data/readiness-index.json",
        method: "GET",
        description: "Download public Packrift procurement-readiness rows.",
        parameters: [],
        response_description: "JSON object with release stats and Packrift SKU rows containing public readiness fields.",
      },
      {
        path: "/data/stats.json",
        method: "GET",
        description: "Fetch release counts for source products, eligible rows, public SKU pages, and field coverage.",
        parameters: [],
        response_description: "JSON release statistics for the Procurement Readiness Index.",
      },
      {
        path: "/data/field-dictionary.csv",
        method: "GET",
        description: "Download plain-English field definitions for the public readiness dataset.",
        parameters: [],
        response_description: "CSV field dictionary for SKU, readiness score, product type, availability, price band, weight band, GTIN, and URL fields.",
      },
      {
        path: representativeType ? `/types/${representativeType}/` : "/data/",
        method: "GET",
        description: "Read a representative product-type readiness index page.",
        parameters: [],
        response_description: "HTML product-type page listing Packrift public readiness rows for that packaging category.",
      },
      {
        path: representativeSku ? `/sku/${representativeSku}/` : "/data/readiness-index.json",
        method: "GET",
        description: "Read a representative SKU procurement-readiness page.",
        parameters: [],
        response_description: "HTML SKU page with readiness score, stock signal, GTIN signal, weight band, price band, and canonical Packrift product link.",
      },
    ],
    authentication: {
      required: false,
      type: "none",
      instructions: null,
    },
    pricing: {
      model: "free",
      free_tier: {
        queries_per_day: null,
        queries_per_month: null,
      },
      paid_tier: null,
      support_url: "https://packrift.com/pages/contact",
    },
    payment: null,
    rate_limits: {
      requests_per_minute: null,
      requests_per_day: null,
    },
    reliability: {
      maintained_by: "organization",
      status_url: null,
      expected_uptime_pct: null,
    },
    agent_notes: `Use this manifest as a read-only entry point for Packrift procurement-readiness review data across ${stats.published_sku_pages} public SKU pages, ${stats.product_type_pages} product-type pages, and ${stats.price_band_pages} price-band pages. Access is free, and no account, credential, token, API key, payment, checkout, carrier account, or password is required for the public files listed here. Do not treat static readiness records as live inventory promises, freight quotes, supplier-cost disclosures, or checkout/order completion. Use Packrift.com and Packrift MCP for live price, inventory, freight, cart, and buyer-specific checks.`,
    contact: {
      email: "farhan@packrift.com",
      support_url: "https://packrift.com/pages/contact",
      github: "https://github.com/Packrift",
    },
    listing_requested: true,
    last_updated: AGENT_MANIFEST_UPDATED_AT,
  };
};

const homeBody = `
<section class="summary">
  <div class="metric"><strong>${stats.published_sku_pages.toLocaleString()}</strong> public SKU readiness pages</div>
  <div class="metric"><strong>${stats.in_stock_rows.toLocaleString()}</strong> in-stock rows in this public release</div>
  <div class="metric"><strong>${stats.rows_with_gtin.toLocaleString()}</strong> rows with GTIN evidence</div>
  <div class="metric"><strong>${stats.product_type_pages.toLocaleString()}</strong> product-type indexes</div>
</section>
<p class="note">This is a discovery and procurement-readiness corpus, not a paid placement or backlink scheme. It exposes public Packrift catalog facts that help buyers, crawlers, and AI agents understand what SKUs are ready for quote, reorder, and product matching.</p>
<h2>Product-Type Indexes</h2>
<div class="grid">${[...byType.values()]
  .sort((a, b) => b.rows.length - a.rows.length)
  .slice(0, 24)
  .map((group) => `<a class="card" href="/types/${group.slug}/"><strong>${escapeHtml(group.label)}</strong><br>${group.rows.length.toLocaleString()} public rows</a>`)
  .join("")}</div>
<h2>Price Bands</h2>
<div class="grid">${[...byBand.values()]
  .sort((a, b) => a.slug.localeCompare(b.slug))
  .map((group) => `<a class="card" href="/price-bands/${group.slug}/"><strong>${escapeHtml(group.label)}</strong><br>${group.rows.length.toLocaleString()} public rows</a>`)
  .join("")}</div>
<h2>High-Readiness Sample</h2>
${rowsTable(publicRows.slice(0, 30))}
<h2>Machine-Readable Files</h2>
<div class="grid">
  <a class="card" href="/data/readiness-index.json">JSON release</a>
  <a class="card" href="/data/readiness-index.jsonl">JSONL release</a>
  <a class="card" href="/data/readiness-index.csv">CSV release</a>
  <a class="card" href="/metadata.json">Croissant metadata</a>
  <a class="card" href="/datapackage.json">Data Package</a>
  <a class="card" href="/dcat.jsonld">DCAT JSON-LD</a>
  <a class="card" href="/openapi.json">OpenAPI descriptor</a>
  <a class="card" href="/.well-known/agent-manifest.json">Agent Manifest</a>
  <a class="card" href="/llms.txt">LLMs text brief</a>
</div>`;

write(
  "index.html",
  layout({
    title: "Packrift Procurement Readiness Index",
    description:
      "Public Packrift catalog readiness data for packaging buyers, procurement teams, and AI agents: stock, GTIN, weight, price band, product type, and product URL coverage.",
    canonical: `${SITE}/`,
    body: homeBody,
    extraHead: `<script type="application/ld+json">${JSON.stringify(datasetJsonLd)}</script>`,
  })
);

for (const row of publicRows) {
  const body = `
<section class="summary">
  <div class="metric"><strong class="score">${row.readiness_score}</strong> readiness score</div>
  <div class="metric"><strong>${row.in_stock ? "Yes" : "No"}</strong> in stock</div>
  <div class="metric"><strong>${row.gtins.length ? "Yes" : "No"}</strong> GTIN present</div>
  <div class="metric"><strong>${escapeHtml(row.weight_band)}</strong> weight band</div>
</section>
<p class="note">This SKU page is generated from public catalog fields and links back to the canonical Packrift product page. It excludes internal commercial fields.</p>
<h2>Procurement Signals</h2>
<div class="grid">
  <div class="card"><strong>SKU</strong><br>${escapeHtml(row.sku)}</div>
  <div class="card"><strong>Product type</strong><br>${escapeHtml(row.product_type)}</div>
  <div class="card"><strong>Availability</strong><br>${escapeHtml(row.availability)}</div>
  <div class="card"><strong>Price band</strong><br>${escapeHtml(row.price_band)}</div>
  <div class="card"><strong>Shipping weight</strong><br>${row.shipping_weight_lb == null ? "Unknown" : `${row.shipping_weight_lb.toFixed(2)} lb`}</div>
  <div class="card"><strong>GTIN</strong><br>${escapeHtml(row.gtins[0] || "Not published")}</div>
</div>
<h2>Buyer Notes</h2>
<p>${escapeHtml(row.description)}</p>
<p>${row.highlights.map((text) => `<span class="pill">${escapeHtml(text)}</span>`).join("")}</p>
<p><a href="${escapeHtml(row.url)}">Open the canonical Packrift product page</a></p>`;
  write(
    `sku/${row.page_slug}/index.html`,
    layout({
      title: `${row.sku} Procurement Readiness | Packrift`,
      description: `${row.title} readiness facts for packaging procurement and AI-agent product matching.`,
      canonical: `${SITE}/sku/${row.page_slug}/`,
      body,
      extraHead: `<script type="application/ld+json">${JSON.stringify(productJsonLd(row))}</script>`,
    })
  );
}

for (const group of byType.values()) {
  write(
    `types/${group.slug}/index.html`,
    layout({
      title: `${group.label} Procurement Readiness | Packrift`,
      description: `Packrift ${group.label} public readiness rows grouped for buyer and agent discovery.`,
      canonical: `${SITE}/types/${group.slug}/`,
      body: `<p>${group.rows.length.toLocaleString()} public readiness rows in this product type.</p>${rowsTable(group.rows.slice(0, 200))}`,
    })
  );
}

for (const group of byBand.values()) {
  write(
    `price-bands/${group.slug}/index.html`,
    layout({
      title: `${group.label} Price Band | Packrift Procurement Readiness`,
      description: `Packrift public readiness rows in the ${group.label} price band.`,
      canonical: `${SITE}/price-bands/${group.slug}/`,
      body: `<p>${group.rows.length.toLocaleString()} public readiness rows in this price band.</p>${rowsTable(group.rows.slice(0, 200))}`,
    })
  );
}

const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvHeaders = [
  "sku",
  "title",
  "product_type",
  "availability",
  "readiness_score",
  "price_band",
  "shipping_weight_lb",
  "weight_band",
  "has_gtin",
  "gtin",
  "url",
];
const publicData = publicRows.map((row) => ({
  sku: row.sku,
  title: row.title,
  product_type: row.product_type,
  availability: row.availability,
  readiness_score: row.readiness_score,
  price_band: row.price_band,
  shipping_weight_lb: row.shipping_weight_lb,
  weight_band: row.weight_band,
  has_gtin: row.has_gtin,
  gtin: row.gtins[0] || "",
  url: row.url,
}));

write("data/readiness-index.json", JSON.stringify({ stats, rows: publicData }, null, 2));
write("data/readiness-index.jsonl", publicData.map((row) => JSON.stringify(row)).join("\n") + "\n");
write("data/readiness-index.csv", [csvHeaders.join(","), ...publicData.map((row) => csvHeaders.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n");
write("data/field-dictionary.csv", `field,description\nsku,Packrift SKU\nreadiness_score,0-100 public-data readiness score\nproduct_type,Packrift catalog product type\navailability,Merchant Center availability value\nprice_band,Public price bucket using public catalog price only\nshipping_weight_lb,Published shipping weight in pounds where present\nweight_band,Shipping weight bucket\nhas_gtin,Whether a GTIN is published for matching\nurl,Canonical Packrift product URL\n`);
write("data/stats.json", JSON.stringify(stats, null, 2));
write("data/index.html", layout({
  title: "Packrift Procurement Readiness Data Files",
  description: "Machine-readable Packrift Procurement Readiness Index files for crawlers, buyers, and AI agents.",
  canonical: `${SITE}/data/`,
  body: `<div class="grid"><a class="card" href="/data/readiness-index.json">readiness-index.json</a><a class="card" href="/data/readiness-index.jsonl">readiness-index.jsonl</a><a class="card" href="/data/readiness-index.csv">readiness-index.csv</a><a class="card" href="/data/field-dictionary.csv">field-dictionary.csv</a><a class="card" href="/data/stats.json">stats.json</a></div>`,
}));

const urlSet = [
  `${SITE}/`,
  `${SITE}/data/`,
  `${SITE}/data/readiness-index.json`,
  `${SITE}/data/readiness-index.jsonl`,
  `${SITE}/data/readiness-index.csv`,
  `${SITE}/data/field-dictionary.csv`,
  `${SITE}/data/stats.json`,
  `${SITE}/metadata.json`,
  `${SITE}/datapackage.json`,
  `${SITE}/dcat.jsonld`,
  `${SITE}/datacite.json`,
  `${SITE}/CITATION.cff`,
  `${SITE}/checksums.sha256`,
  `${SITE}/openapi.json`,
  `${SITE}/.well-known/openapi.json`,
  `${SITE}/.well-known/ai-plugin.json`,
  `${SITE}/agent-manifest.json`,
  `${SITE}/.well-known/agent-manifest.json`,
  `${SITE}/llms.txt`,
  ...publicRows.map((row) => `${SITE}/sku/${row.page_slug}/`),
  ...[...byType.values()].map((group) => `${SITE}/types/${group.slug}/`),
  ...[...byBand.values()].map((group) => `${SITE}/price-bands/${group.slug}/`),
];

write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlSet
  .map((url) => `  <url><loc>${url}</loc><lastmod>${GENERATED_AT.slice(0, 10)}</lastmod></url>`)
  .join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
write("llms.txt", `# Packrift Procurement Readiness Index\n\nPublic URL: ${SITE}/\n\nThis Packrift-owned public data asset summarizes ${stats.published_sku_pages} packaging SKUs for buyer and AI-agent procurement readiness. It includes SKU, product type, availability, GTIN presence, public product URL, price band, shipping weight band, and a simple readiness score. Internal commercial fields are excluded.\n\nKey files:\n- ${SITE}/data/readiness-index.json\n- ${SITE}/data/readiness-index.jsonl\n- ${SITE}/data/readiness-index.csv\n- ${SITE}/metadata.json\n- ${SITE}/openapi.json\n- ${SITE}/.well-known/agent-manifest.json\n`);
write("indexnow-key.txt", `${INDEXNOW_KEY}\n`);
write(`${INDEXNOW_KEY}.txt`, `${INDEXNOW_KEY}\n`);

const metadata = {
  "@context": {
    "@vocab": "https://schema.org/",
    croissant: "http://mlcommons.org/croissant/",
  },
  "@type": "Dataset",
  name: "Packrift Procurement Readiness Index",
  description: datasetJsonLd.description,
  url: SITE,
  dateModified: GENERATED_AT,
  creator: { "@type": "Organization", name: "Packrift", url: "https://packrift.com" },
  distribution: [
    { "@type": "DataDownload", name: "JSON", contentUrl: `${SITE}/data/readiness-index.json`, encodingFormat: "application/json" },
    { "@type": "DataDownload", name: "JSONL", contentUrl: `${SITE}/data/readiness-index.jsonl`, encodingFormat: "application/x-ndjson" },
    { "@type": "DataDownload", name: "CSV", contentUrl: `${SITE}/data/readiness-index.csv`, encodingFormat: "text/csv" },
  ],
  recordSet: [
    {
      "@type": "Dataset",
      name: "readiness rows",
      description: "One row per public Packrift SKU in this release.",
      field: csvHeaders.map((name) => ({ "@type": "PropertyValue", name })),
    },
  ],
  conformsTo: "http://mlcommons.org/croissant/1.1",
};
write("metadata.json", JSON.stringify(metadata, null, 2));

write("datapackage.json", JSON.stringify({
  profile: "data-package",
  name: "packrift-procurement-readiness-index",
  title: "Packrift Procurement Readiness Index",
  description: datasetJsonLd.description,
  homepage: SITE,
  created: GENERATED_AT,
  resources: [
    { name: "readiness-index", path: "data/readiness-index.csv", format: "csv", mediatype: "text/csv" },
    { name: "field-dictionary", path: "data/field-dictionary.csv", format: "csv", mediatype: "text/csv" },
  ],
}, null, 2));

write("dcat.jsonld", JSON.stringify({
  "@context": {
    dcat: "http://www.w3.org/ns/dcat#",
    dct: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
  },
  "@id": SITE,
  "@type": "dcat:Dataset",
  "dct:title": "Packrift Procurement Readiness Index",
  "dct:description": datasetJsonLd.description,
  "dct:publisher": { "@type": "foaf:Organization", "foaf:name": "Packrift" },
  "dcat:distribution": [
    { "@type": "dcat:Distribution", "dcat:downloadURL": `${SITE}/data/readiness-index.csv`, "dct:format": "text/csv" },
    { "@type": "dcat:Distribution", "dcat:downloadURL": `${SITE}/data/readiness-index.json`, "dct:format": "application/json" },
  ],
}, null, 2));

write("datacite.json", JSON.stringify({
  doi: "",
  creators: [{ name: "Packrift" }],
  titles: [{ title: "Packrift Procurement Readiness Index" }],
  publisher: "Packrift",
  publicationYear: "2026",
  resourceType: { resourceTypeGeneral: "Dataset", resourceType: "Public catalog readiness index" },
  descriptions: [{ descriptionType: "Abstract", description: datasetJsonLd.description }],
  url: SITE,
}, null, 2));

write("CITATION.cff", `cff-version: 1.2.0\ntitle: Packrift Procurement Readiness Index\nmessage: Cite this public Packrift catalog-readiness data asset by URL.\ntype: dataset\nauthors:\n  - name: Packrift\nurl: ${SITE}/\ndate-released: ${GENERATED_AT.slice(0, 10)}\n`);

const openapi = {
  openapi: "3.1.0",
  info: { title: "Packrift Procurement Readiness Index", version: "2026-05-30" },
  servers: [{ url: SITE }],
  paths: {
    "/data/readiness-index.json": {
      get: {
        summary: "Return public Packrift procurement readiness rows",
        responses: { "200": { description: "Readiness rows JSON" } },
      },
    },
    "/data/stats.json": {
      get: {
        summary: "Return release statistics",
        responses: { "200": { description: "Release statistics JSON" } },
      },
    },
  },
};
write("openapi.json", JSON.stringify(openapi, null, 2));
write(".well-known/openapi.json", JSON.stringify(openapi, null, 2));
write(".well-known/ai-plugin.json", JSON.stringify({
  schema_version: "v1",
  name_for_human: "Packrift Procurement Readiness Index",
  name_for_model: "packrift_procurement_readiness_index",
  description_for_human: "Public Packrift packaging SKU readiness data for procurement and AI-agent matching.",
  description_for_model: "Use this Packrift-owned public dataset to inspect product readiness signals such as availability, GTIN presence, product type, price band, and shipping weight band.",
  auth: { type: "none" },
  api: { type: "openapi", url: `${SITE}/openapi.json` },
  logo_url: `${SITE}/favicon.svg`,
  contact_email: "support@packrift.com",
  legal_info_url: "https://packrift.com/policies/terms-of-service",
}, null, 2));

const amp = agentManifest();
write("agent-manifest.json", JSON.stringify(amp, null, 2));
write(".well-known/agent-manifest.json", JSON.stringify(amp, null, 2));

write("favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#285f3a"/><path d="M14 20h36v28H14z" fill="#fbfcf8"/><path d="M14 20l18-9 18 9-18 9z" fill="#d7a35f"/><path d="M32 29v19" stroke="#285f3a" stroke-width="4"/></svg>`);
write("vercel.json", JSON.stringify({
  cleanUrls: true,
  trailingSlash: true,
  headers: [
    { source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "index, follow" }] },
  ],
}, null, 2));

const checksumFiles = [
  "index.html",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "indexnow-key.txt",
  `${INDEXNOW_KEY}.txt`,
  "metadata.json",
  "datapackage.json",
  "dcat.jsonld",
  "datacite.json",
  "CITATION.cff",
  "openapi.json",
  "agent-manifest.json",
  ".well-known/agent-manifest.json",
  "data/readiness-index.json",
  "data/readiness-index.jsonl",
  "data/readiness-index.csv",
  "data/field-dictionary.csv",
  "data/stats.json",
];
write(
  "checksums.sha256",
  checksumFiles
    .map((file) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex")}  ${file}`)
    .join("\n") + "\n"
);

write("README.md", `# Packrift Procurement Readiness Index\n\nGenerated ${GENERATED_AT} from ${SOURCE}.\n\nPublic target: ${SITE}/\n\nThis asset publishes public catalog-readiness signals only and excludes internal commercial fields.\n`);

write("build-summary.json", JSON.stringify({ stats, url_count: urlSet.length, sample_urls: urlSet.slice(0, 20) }, null, 2));
console.log(JSON.stringify({ stats, url_count: urlSet.length }, null, 2));
