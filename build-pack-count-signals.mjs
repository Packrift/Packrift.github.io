import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath =
  process.env.PRODUCTS_JSON ||
  "/Users/farhan/Downloads/packrift-backlinks/execution/packrift-operations-resource-graph-2026-05-28/data/products.json";
const site = "https://packrift.github.io";
const generatedAt = new Date().toISOString();
const indexNowKey = "7d4ea0e32d6f4924b35d7b8c4e3a95f1";

function ensureDir(rel) {
  fs.mkdirSync(path.join(root, rel), { recursive: true });
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return content;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function js(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function slugify(value) {
  return (
    String(value || "packrift")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "packrift"
  );
}

function cleanText(value) {
  return String(value ?? "")
    .replaceAll("\u201a\u00c4\u00ec", "-")
    .replaceAll("\u201a\u00c4\u00ee", "-")
    .replaceAll("\u201a\u00c4\u00f4", "'")
    .replaceAll("\u201a\u00c4\u00fa", '"')
    .replaceAll("\u201a\u00c4\u00f9", '"')
    .replaceAll("\u00e2\u20ac\u201c", "-")
    .replaceAll("\u00e2\u20ac\u201d", "-")
    .replaceAll("\u00e2\u20ac\u2122", "'")
    .replaceAll("\u00e2\u20ac\u0153", '"')
    .replaceAll("\u00e2\u20ac\ufffd", '"')
    .replace(/\s+/g, " ")
    .trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value) {
  const n = number(value);
  return n != null && n > 0 ? n : null;
}

function round(value, places = 4) {
  const n = number(value);
  if (n == null) return null;
  return Number(n.toFixed(places));
}

function money(value, places = 2) {
  const n = number(value);
  return n == null ? "source missing" : `$${n.toFixed(places)}`;
}

function qty(value, places = 2) {
  const n = number(value);
  if (n == null) return "source missing";
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: places });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function publicStatus(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "source review";
  if (raw === "AI_APPROVE" || raw === "APPROVED") return "catalog approved";
  if (raw === "ACTIVE") return "active listing";
  return raw.toLowerCase().replace(/_/g, " ");
}

function publicAvailability(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "availability unknown";
  if (raw === "IN_STOCK") return "in stock";
  if (raw === "OUT_OF_STOCK") return "out of stock";
  return raw.toLowerCase().replace(/_/g, " ");
}

function titleCaseLabel(value) {
  return cleanText(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function weightUnitLabel(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "POUNDS" || raw === "POUND" || raw === "LBS") return "lb";
  if (raw === "OUNCES" || raw === "OUNCE" || raw === "OZ") return "oz";
  if (raw === "GRAMS" || raw === "GRAM") return "g";
  if (raw === "KILOGRAMS" || raw === "KILOGRAM") return "kg";
  return cleanText(value || "lb").toLowerCase();
}

function unitWord(value) {
  return Number(value) === 1 ? "unit" : "units";
}

function unitPriceBand(value) {
  const n = number(value);
  if (n == null) return { slug: "unknown", label: "unknown unit price" };
  if (n < 0.05) return { slug: "under-5-cents", label: "under $0.05 per unit" };
  if (n < 0.1) return { slug: "5-to-10-cents", label: "$0.05 to $0.10 per unit" };
  if (n < 0.25) return { slug: "10-to-25-cents", label: "$0.10 to $0.25 per unit" };
  if (n < 0.5) return { slug: "25-to-50-cents", label: "$0.25 to $0.50 per unit" };
  if (n < 1) return { slug: "50-cents-to-1-dollar", label: "$0.50 to $1 per unit" };
  if (n < 5) return { slug: "1-to-5-dollars", label: "$1 to $5 per unit" };
  return { slug: "5-dollars-plus", label: "$5+ per unit" };
}

function unitWeightBand(value) {
  const n = number(value);
  if (n == null) return { slug: "unknown", label: "unknown unit weight" };
  if (n < 0.05) return { slug: "under-0-05-lb", label: "under 0.05 lb per unit" };
  if (n < 0.25) return { slug: "0-05-to-0-25-lb", label: "0.05 to 0.25 lb per unit" };
  if (n < 1) return { slug: "0-25-to-1-lb", label: "0.25 to 1 lb per unit" };
  if (n < 5) return { slug: "1-to-5-lb", label: "1 to 5 lb per unit" };
  return { slug: "5-lb-plus", label: "5+ lb per unit" };
}

function packClass(packCount) {
  const n = number(packCount);
  if (n == null) return { slug: "unknown", label: "unknown pack size" };
  if (n <= 10) return { slug: "small-packs", label: "small packs, 1-10 units" };
  if (n <= 50) return { slug: "case-packs", label: "case packs, 11-50 units" };
  if (n <= 250) return { slug: "bulk-packs", label: "bulk packs, 51-250 units" };
  return { slug: "warehouse-packs", label: "warehouse packs, 251+ units" };
}

function normalize(row, index, seen) {
  const sku = String(row.sku || `row-${index + 1}`).trim();
  const title = cleanText(row.title || sku);
  const handle = cleanText(row.handle || row.productUrl?.split("/").filter(Boolean).pop() || title);
  const baseSlug = `${slugify(sku)}-${slugify(handle)}`.slice(0, 170);
  const duplicate = seen.get(baseSlug) || 0;
  seen.set(baseSlug, duplicate + 1);
  const slug = duplicate ? `${baseSlug}-${duplicate + 1}` : baseSlug;
  const length = positive(row.length);
  const width = positive(row.width);
  const height = positive(row.height);
  const volume = length && width && height ? length * width * height : null;
  const packCount = positive(row.packCount);
  const price = positive(row.price);
  const weight = positive(row.weight);
  const unitPrice = price && packCount ? price / packCount : null;
  const unitWeight = weight && packCount ? weight / packCount : null;
  const unitVolume = volume && packCount ? volume / packCount : null;
  const priceBand = unitPriceBand(unitPrice);
  const weightBand = unitWeightBand(unitWeight);
  const sizeClass = packClass(packCount);

  return {
    id: index + 1,
    slug,
    sku,
    title,
    handle,
    offerId: row.offerId || "",
    productId: row.productId || "",
    variantId: row.variantId || "",
    productUrl: row.productUrl || "",
    family: cleanText(row.family || "packaging"),
    familyLabel: titleCaseLabel(row.familyLabel || row.family || "Packaging"),
    productType: cleanText(row.productType || "Packaging"),
    price,
    inventory: number(row.inventory),
    weight,
    weightUnit: weightUnitLabel(row.weightUnit || "POUNDS"),
    length,
    width,
    height,
    volume,
    packCount,
    unitPrice,
    unitWeight,
    unitVolume,
    unitPriceBand: priceBand.slug,
    unitPriceBandLabel: priceBand.label,
    unitWeightBand: weightBand.slug,
    unitWeightBandLabel: weightBand.label,
    packClass: sizeClass.slug,
    packClassLabel: sizeClass.label,
    statusRaw: row.status || "",
    merchantStatusRaw: row.merchantStatus || "",
    merchantAvailabilityRaw: row.merchantAvailability || "",
    status: publicStatus(row.status || ""),
    merchantStatus: publicStatus(row.merchantStatus || ""),
    merchantAvailability: publicAvailability(row.merchantAvailability || ""),
  };
}

function isEligible(row) {
  return (
    row.statusRaw === "AI_APPROVE" &&
    row.merchantAvailabilityRaw === "IN_STOCK" &&
    row.productUrl.startsWith("https://packrift.com/products/") &&
    Boolean(row.sku && row.title && row.familyLabel && row.productType) &&
    row.price != null &&
    row.inventory != null &&
    row.weight != null &&
    row.length != null &&
    row.width != null &&
    row.height != null &&
    row.packCount != null &&
    row.unitPrice != null &&
    row.unitWeight != null &&
    row.unitVolume != null
  );
}

function addGroup(map, slug, label, row) {
  if (!map.has(slug)) map.set(slug, { slug, label, rows: [] });
  map.get(slug).rows.push(row);
}

const rawProducts = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const seen = new Map();
const allRows = rawProducts.map((row, index) => normalize(row, index, seen));
const published = allRows
  .filter(isEligible)
  .sort((a, b) => {
    const family = a.familyLabel.localeCompare(b.familyLabel);
    if (family) return family;
    const pack = a.packCount - b.packCount;
    if (pack) return pack;
    return a.sku.localeCompare(b.sku);
  });

const packCountMap = new Map();
const familyMap = new Map();
const typeMap = new Map();
const unitPriceMap = new Map();
const unitWeightMap = new Map();
const packClassMap = new Map();

for (const row of published) {
  addGroup(packCountMap, String(row.packCount).replace(/\./g, "-"), `${qty(row.packCount, 0)} unit pack`, row);
  addGroup(familyMap, slugify(row.familyLabel), row.familyLabel, row);
  addGroup(typeMap, slugify(row.productType), row.productType, row);
  addGroup(unitPriceMap, row.unitPriceBand, row.unitPriceBandLabel, row);
  addGroup(unitWeightMap, row.unitWeightBand, row.unitWeightBandLabel, row);
  addGroup(packClassMap, row.packClass, row.packClassLabel, row);
}

function sortedGroups(map) {
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
}

const stats = {
  generatedAt,
  sourcePath,
  sourceProducts: rawProducts.length,
  eligibleProducts: published.length,
  packCountPages: packCountMap.size,
  familyPages: familyMap.size,
  productTypePages: typeMap.size,
  unitPriceBandPages: unitPriceMap.size,
  unitWeightBandPages: unitWeightMap.size,
  packClassPages: packClassMap.size,
  medianPackCount: median(published.map((row) => row.packCount)),
  medianUnitPrice: round(median(published.map((row) => row.unitPrice)), 4),
  medianUnitWeight: round(median(published.map((row) => row.unitWeight)), 4),
};

function median(values) {
  const nums = values.filter((value) => value != null).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

const css = `
:root { color-scheme: light; --ink:#18231f; --muted:#53615b; --line:#d9e1dc; --paper:#f8faf7; --panel:#ffffff; --soft:#eef4ef; --accent:#245f46; --blue:#285e73; --amber:#8a5b24; --rose:#8a4054; }
* { box-sizing:border-box; }
html, body { overflow-x:hidden; }
body { margin:0; background:var(--paper); color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.5; }
a { color:var(--accent); text-underline-offset:.18em; overflow-wrap:anywhere; }
header { background:#fff; border-bottom:1px solid var(--line); padding:30px 20px 24px; }
main { max-width:min(1200px,100vw); padding:28px 20px 56px; }
footer { border-top:1px solid var(--line); padding:24px 20px; color:var(--muted); font-size:13px; }
.kicker { font-size:12px; font-weight:800; color:var(--amber); text-transform:uppercase; letter-spacing:0; }
h1 { margin:8px 0 12px; max-width:340px; font-size:28px; line-height:1.08; letter-spacing:0; overflow-wrap:anywhere; }
h2 { margin:34px 0 12px; font-size:24px; line-height:1.16; letter-spacing:0; }
h3 { margin:0 0 8px; font-size:18px; line-height:1.2; letter-spacing:0; }
p { max-width:100%; color:var(--muted); overflow-wrap:anywhere; }
header p, .narrow, .chart, .table-wrap, .metrics, .grid { max-width:340px; }
.metrics { display:grid; grid-template-columns:1fr; gap:12px; margin:22px 0; }
.metric, .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
.metric, .card, .split > * { min-width:0; }
.metric strong { display:block; color:var(--ink); font-size:24px; line-height:1.05; }
.metric span { display:block; color:var(--muted); font-size:13px; margin-top:4px; }
.grid { display:grid; grid-template-columns:1fr; gap:12px; }
.chart { background:#fff; border:1px solid var(--line); border-radius:8px; padding:12px; overflow:hidden; min-width:0; }
.chart svg { display:block; width:100%; max-width:100%; height:auto; }
.table-wrap { overflow:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
table { width:100%; min-width:920px; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px solid var(--line); }
th { background:var(--soft); color:#27372d; }
.pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:2px 8px; margin:2px 4px 2px 0; font-size:12px; background:#fff; color:#334238; }
.note { padding:12px 14px; border-left:4px solid var(--accent); background:var(--soft); color:#334238; max-width:100%; overflow-wrap:anywhere; }
.split { display:block; max-width:340px; }
.split .chart { margin-top:12px; }
@media (min-width: 560px) {
  header { padding:34px min(6vw,60px) 26px; }
  main { padding:30px min(6vw,60px) 56px; }
  footer { padding:24px min(6vw,60px); }
  header p, .narrow { max-width:900px; }
  h1 { max-width:1020px; font-size:clamp(32px,5vw,56px); line-height:1.03; }
  .metrics { max-width:1080px; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
  .grid { max-width:none; grid-template-columns:repeat(auto-fit,minmax(235px,1fr)); }
  .split { display:grid; max-width:none; gap:12px; grid-template-columns:1.1fr .9fr; align-items:start; }
  .split .chart { margin-top:0; }
  .chart, .table-wrap { max-width:100%; }
}
`;

function layout({ title, description, canonical, body, jsonLd }) {
  const structured = jsonLd ? `<script type="application/ld+json">${js(jsonLd)}</script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<style>${css}</style>
${structured}
</head>
<body>
<header>
<div class="kicker">Packrift pack count and unit signals</div>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
</header>
<main>${body}</main>
<footer>Generated ${esc(generatedAt)} from Packrift public catalog and operations-product data. This resource reports public price, pack-count, physical-size, and inventory signals only. It is not a margin model, freight quote, or checkout commitment.</footer>
</body>
</html>`;
}

function datasetJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Packrift Pack Count and Unit Signal Atlas",
    description:
      "A public Packrift data asset that normalizes pack counts, unit-price signals, unit-weight signals, unit cube, family groups, and product-type indexes from real Packrift catalog fields.",
    url: site,
    creator: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
    license: "https://packrift.com/policies/terms-of-service",
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${site}/data/unit-signals.json` },
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${site}/data/unit-signals.jsonl` },
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${site}/data/unit-signals.csv` },
    ],
  };
}

function productJsonLd(row) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: row.title,
    sku: row.sku,
    brand: { "@type": "Brand", name: "Packrift" },
    category: row.productType,
    url: row.productUrl,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: row.price,
      availability: "https://schema.org/InStock",
      url: row.productUrl,
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Pack count", value: String(row.packCount) },
      { "@type": "PropertyValue", name: "Public unit price signal", value: String(round(row.unitPrice, 4)) },
      { "@type": "PropertyValue", name: "Public unit weight signal", value: `${round(row.unitWeight, 4)} ${row.weightUnit}` },
      { "@type": "PropertyValue", name: "Unit cube signal", value: `${round(row.unitVolume, 4)} cubic inches` },
      { "@type": "PropertyValue", name: "Packrift signal page", value: `${site}/products/${row.slug}/` },
    ],
  };
}

function groupJsonLd(group, pathName, name) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: `${site}${pathName}`,
    about: "Packrift packaging pack counts and public unit signals",
    isPartOf: { "@type": "Dataset", name: "Packrift Pack Count and Unit Signal Atlas", url: site },
    publisher: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
    numberOfItems: group.rows.length,
  };
}

function productTable(rows, limit = rows.length) {
  return `<div class="table-wrap"><table>
<thead><tr><th>SKU</th><th>Packrift title</th><th>Pack count</th><th>Unit price</th><th>Unit weight</th><th>Unit cube</th><th>Family</th></tr></thead>
<tbody>
${rows
  .slice(0, limit)
  .map(
    (row) => `<tr>
<td><a href="/products/${row.slug}/">${esc(row.sku)}</a></td>
<td>${esc(row.title)}</td>
<td>${qty(row.packCount, 0)}</td>
<td>${money(row.unitPrice, 4)}</td>
<td>${qty(row.unitWeight, 4)} ${esc(row.weightUnit)}</td>
<td>${qty(row.unitVolume, 2)} in^3</td>
<td><a href="/families/${slugify(row.familyLabel)}/">${esc(row.familyLabel)}</a></td>
</tr>`
  )
  .join("\n")}
</tbody></table></div>`;
}

function groupCards(groups, basePath, unit = "records") {
  return `<div class="grid">
${groups
  .map(
    (group) => `<div class="card"><h3><a href="${basePath}${group.slug}/">${esc(group.label)}</a></h3><p>${group.rows.length.toLocaleString()} ${unit}. Median unit price ${money(median(group.rows.map((row) => row.unitPrice)), 4)}.</p></div>`
  )
  .join("\n")}
</div>`;
}

function barChart(groups, title) {
  const chartGroups = groups.slice(0, 14);
  const max = Math.max(...chartGroups.map((group) => group.rows.length), 1);
  const width = 900;
  const rowHeight = 34;
  const height = 42 + chartGroups.length * rowHeight;
  return `<div class="chart" role="img" aria-label="${esc(title)}">
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<title>${esc(title)}</title>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<text x="18" y="26" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#18231f">${esc(title)}</text>
${chartGroups
  .map((group, index) => {
    const y = 46 + index * rowHeight;
    const barWidth = Math.max(4, Math.round((group.rows.length / max) * 520));
    const color = index % 4 === 0 ? "#245f46" : index % 4 === 1 ? "#285e73" : index % 4 === 2 ? "#8a5b24" : "#8a4054";
    return `<text x="18" y="${y + 16}" font-family="system-ui, sans-serif" font-size="13" fill="#53615b">${esc(group.label.slice(0, 34))}</text>
<rect x="270" y="${y}" width="${barWidth}" height="20" rx="4" fill="${color}"/>
<text x="${280 + barWidth}" y="${y + 15}" font-family="system-ui, sans-serif" font-size="13" fill="#18231f">${group.rows.length.toLocaleString()}</text>`;
  })
  .join("\n")}
</svg></div>`;
}

ensureDir("products");
ensureDir("pack-counts");
ensureDir("families");
ensureDir("product-types");
ensureDir("unit-price-bands");
ensureDir("unit-weight-bands");
ensureDir("pack-classes");
ensureDir("data");
ensureDir("assets");
ensureDir(".well-known");

const packCountGroups = sortedGroups(packCountMap);
const familyGroups = sortedGroups(familyMap);
const typeGroups = sortedGroups(typeMap);
const priceGroups = sortedGroups(unitPriceMap);
const weightGroups = sortedGroups(unitWeightMap);
const classGroups = sortedGroups(packClassMap);

write("assets/pack-count-distribution.svg", barChart(packCountGroups, "Packrift pack-count distribution").match(/<svg[\s\S]*<\/svg>/)[0] + "\n");
write("assets/unit-price-bands.svg", barChart(priceGroups, "Packrift public unit-price bands").match(/<svg[\s\S]*<\/svg>/)[0] + "\n");

const supportUrls = [
  "/",
  "/methodology/",
  "/data/",
  "/pack-counts/",
  "/families/",
  "/product-types/",
  "/unit-price-bands/",
  "/unit-weight-bands/",
  "/pack-classes/",
  "/assets/pack-count-distribution.svg",
  "/assets/unit-price-bands.svg",
  "/data/manifest.json",
  "/data/unit-signals.json",
  "/data/unit-signals.jsonl",
  "/data/unit-signals.csv",
  "/data/pack-counts.json",
  "/data/families.json",
  "/data/product-types.json",
  "/data/schema.json",
  "/data/field-dictionary.csv",
  "/openapi.json",
  "/.well-known/openapi.json",
  "/.well-known/ai-plugin.json",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/metadata.json",
  "/datapackage.json",
  "/dcat.jsonld",
  "/datacite.json",
  "/CITATION.cff",
  "/checksums.sha256",
  `/${indexNowKey}.txt`,
];

write(
  "index.html",
  layout({
    title: "Packrift Pack Count and Unit Signal Atlas",
    description:
      "A crawlable public Packrift resource that turns real catalog pack counts, prices, weights, dimensions, and inventory signals into product pages, comparison indexes, and machine-readable data files.",
    canonical: `${site}/`,
    jsonLd: datasetJsonLd(),
    body: `
<section class="metrics">
<div class="metric"><strong>${stats.eligibleProducts.toLocaleString()}</strong><span>complete public product signal pages</span></div>
<div class="metric"><strong>${stats.packCountPages}</strong><span>pack-count indexes</span></div>
<div class="metric"><strong>${qty(stats.medianPackCount, 0)}</strong><span>median pack count</span></div>
<div class="metric"><strong>${money(stats.medianUnitPrice, 4)}</strong><span>median public unit price signal</span></div>
</section>
<div class="split">
<div>
<p class="note">This atlas is built only from complete Packrift catalog rows with a canonical product URL, pack count, price, weight, dimensions, family, product type, inventory, approved catalog status, and in-stock merchant availability. It does not expose cost, margin, customer, supplier-only, or checkout data.</p>
<h2>Browse by Pack Count</h2>
${groupCards(packCountGroups.slice(0, 12), "/pack-counts/")}
</div>
<div>${barChart(packCountGroups, "Top Pack Count Groups")}</div>
</div>
<h2>Browse Public Unit Signals</h2>
<div class="grid">
<div class="card"><h3><a href="/unit-price-bands/">Unit Price Bands</a></h3><p>Public price divided by pack count, grouped into practical ranges for comparison.</p></div>
<div class="card"><h3><a href="/unit-weight-bands/">Unit Weight Bands</a></h3><p>Shipping weight divided by pack count, useful for handling and catalog review.</p></div>
<div class="card"><h3><a href="/families/">Families</a></h3><p>Packaging family indexes across boxes, mailers, bags, labels, and more.</p></div>
<div class="card"><h3><a href="/product-types/">Product Types</a></h3><p>Source product-type indexes with linked Packrift product routes.</p></div>
</div>
<h2>Representative Product Signals</h2>
${productTable(published.slice(0, 45))}
<h2>Machine-Readable Corpus</h2>
<div class="grid">
<div class="card"><h3><a href="/data/unit-signals.json">JSON</a></h3><p>Normalized Packrift product signals with unit-price, unit-weight, and unit-cube fields.</p></div>
<div class="card"><h3><a href="/data/unit-signals.jsonl">JSONL</a></h3><p>Line-oriented records for crawlers, retrieval systems, and data tools.</p></div>
<div class="card"><h3><a href="/data/unit-signals.csv">CSV</a></h3><p>Spreadsheet-ready public unit-signal extract.</p></div>
<div class="card"><h3><a href="/llms.txt">llms.txt</a></h3><p>Agent route map and boundaries for safe citation.</p></div>
</div>`,
  })
);

write(
  "methodology/index.html",
  layout({
    title: "Packrift Unit Signal Methodology",
    description:
      "How the Packrift Pack Count and Unit Signal Atlas is generated, which rows qualify, and what claims the public resource does not make.",
    canonical: `${site}/methodology/`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Packrift Unit Signal Methodology",
      about: "Packrift pack-count, unit-price, unit-weight, and unit-cube public data normalization",
      publisher: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
    },
    body: `
<h2>Source Boundary</h2>
<p>The source is Packrift's cleaned operations product graph derived from public catalog and merchant product fields. The atlas includes only rows with Packrift product URL, approved catalog status, in-stock merchant availability, pack count, price, inventory, weight, dimensions, family, and product type.</p>
<h2>Derived Signals</h2>
<p>Unit price is public price divided by pack count. Unit weight is source product weight divided by pack count. Unit cube is length multiplied by width multiplied by height, divided by pack count. These are comparison signals, not supplier cost, negotiated price, freight rating, margin, or checkout truth.</p>
<h2>Quality Gate</h2>
<p>Generated pages are blocked from publication if complete product signals fall below the threshold, internal status labels appear in public pages, mojibake appears in public titles, machine-readable descriptors are missing, or private cost/customer/supplier-only fields are present.</p>
<h2>Counting Discipline</h2>
<p>This host creates owned Packrift public URLs. Third-party surfaces, IndexNow receipts, SEMrush-visible referring domains, and Bing-visible links are measured in separate ledger buckets only after direct verification.</p>`,
  })
);

function writeIndexPage(rel, title, description, groups, basePath, chartTitle) {
  write(
    `${rel}/index.html`,
    layout({
      title,
      description,
      canonical: `${site}/${rel}/`,
      jsonLd: datasetJsonLd(),
      body: `${barChart(groups, chartTitle)}<h2>Index Pages</h2>${groupCards(groups, basePath)}`,
    })
  );
}

writeIndexPage("pack-counts", "Packrift Pack Count Indexes", "Browse Packrift product signal pages by package count.", packCountGroups, "/pack-counts/", "Pack count records");
writeIndexPage("families", "Packrift Family Unit Signals", "Browse Packrift product signal pages by packaging family.", familyGroups, "/families/", "Family records");
writeIndexPage("product-types", "Packrift Product Type Unit Signals", "Browse Packrift product signal pages by source product type.", typeGroups, "/product-types/", "Product type records");
writeIndexPage("unit-price-bands", "Packrift Unit Price Bands", "Browse Packrift product signal pages by public unit-price band.", priceGroups, "/unit-price-bands/", "Unit price band records");
writeIndexPage("unit-weight-bands", "Packrift Unit Weight Bands", "Browse Packrift product signal pages by public unit-weight band.", weightGroups, "/unit-weight-bands/", "Unit weight band records");
writeIndexPage("pack-classes", "Packrift Pack Size Classes", "Browse Packrift product signal pages by small, case, bulk, and warehouse pack classes.", classGroups, "/pack-classes/", "Pack size class records");

function writeGroupPages(groups, rel, titlePrefix, descriptionPrefix) {
  for (const group of groups) {
    const medUnitPrice = median(group.rows.map((row) => row.unitPrice));
    const medUnitWeight = median(group.rows.map((row) => row.unitWeight));
    write(
      `${rel}/${group.slug}/index.html`,
      layout({
        title: `${titlePrefix}: ${group.label}`,
        description: `${descriptionPrefix} ${group.label}. ${group.rows.length} Packrift product signal pages with median public unit price ${money(medUnitPrice, 4)} and median unit weight ${qty(medUnitWeight, 4)} lb.`,
        canonical: `${site}/${rel}/${group.slug}/`,
        jsonLd: groupJsonLd(group, `/${rel}/${group.slug}/`, `${titlePrefix}: ${group.label}`),
        body: `
<section class="metrics">
<div class="metric"><strong>${group.rows.length.toLocaleString()}</strong><span>public product signal pages</span></div>
<div class="metric"><strong>${money(medUnitPrice, 4)}</strong><span>median public unit price</span></div>
<div class="metric"><strong>${qty(medUnitWeight, 4)} lb</strong><span>median unit weight</span></div>
<div class="metric"><strong>${qty(median(group.rows.map((row) => row.packCount)), 0)}</strong><span>median pack count</span></div>
</section>
${productTable(group.rows)}`,
      })
    );
  }
}

writeGroupPages(packCountGroups, "pack-counts", "Packrift Pack Count", "Packrift product signals for pack count");
writeGroupPages(familyGroups, "families", "Packrift Family", "Packrift product unit signals for family");
writeGroupPages(typeGroups, "product-types", "Packrift Product Type", "Packrift product unit signals for product type");
writeGroupPages(priceGroups, "unit-price-bands", "Packrift Unit Price Band", "Packrift products grouped by public unit-price band");
writeGroupPages(weightGroups, "unit-weight-bands", "Packrift Unit Weight Band", "Packrift products grouped by unit-weight band");
writeGroupPages(classGroups, "pack-classes", "Packrift Pack Size Class", "Packrift products grouped by pack size class");

for (const row of published) {
  write(
    `products/${row.slug}/index.html`,
    layout({
      title: `${row.sku} Packrift Pack Count and Unit Signals`,
      description: `${row.title} public Packrift signal page with pack count ${qty(row.packCount, 0)}, public unit price ${money(row.unitPrice, 4)}, unit weight ${qty(row.unitWeight, 4)} ${row.weightUnit}, and unit cube ${qty(row.unitVolume, 2)} cubic inches.`,
      canonical: `${site}/products/${row.slug}/`,
      jsonLd: productJsonLd(row),
      body: `
<section class="metrics">
<div class="metric"><strong>${esc(row.sku)}</strong><span>Packrift SKU</span></div>
<div class="metric"><strong>${qty(row.packCount, 0)}</strong><span>pack count</span></div>
<div class="metric"><strong>${money(row.unitPrice, 4)}</strong><span>public unit price signal</span></div>
<div class="metric"><strong>${qty(row.unitWeight, 4)} ${esc(row.weightUnit)}</strong><span>unit weight signal</span></div>
</section>
<h2>Product Signal</h2>
<div class="grid">
<div class="card"><h3>Packrift title</h3><p>${esc(row.title)}</p></div>
<div class="card"><h3>Family</h3><p><a href="/families/${slugify(row.familyLabel)}/">${esc(row.familyLabel)}</a></p></div>
<div class="card"><h3>Product type</h3><p><a href="/product-types/${slugify(row.productType)}/">${esc(row.productType)}</a></p></div>
<div class="card"><h3>Pack class</h3><p><a href="/pack-classes/${row.packClass}/">${esc(row.packClassLabel)}</a></p></div>
</div>
<h2>Public Unit Signals</h2>
<div class="grid">
<div class="card"><h3>Public price</h3><p>${money(row.price)} for ${qty(row.packCount, 0)} ${unitWord(row.packCount)}</p></div>
<div class="card"><h3>Public unit price</h3><p><a href="/unit-price-bands/${row.unitPriceBand}/">${money(row.unitPrice, 4)}</a></p></div>
<div class="card"><h3>Source weight</h3><p>${qty(row.weight, 4)} ${esc(row.weightUnit)} per pack</p></div>
<div class="card"><h3>Unit weight</h3><p><a href="/unit-weight-bands/${row.unitWeightBand}/">${qty(row.unitWeight, 4)} ${esc(row.weightUnit)}</a></p></div>
<div class="card"><h3>Dimensions</h3><p>${qty(row.length, 2)} x ${qty(row.width, 2)} x ${qty(row.height, 2)} in</p></div>
<div class="card"><h3>Unit cube</h3><p>${qty(row.unitVolume, 2)} cubic inches</p></div>
</div>
<h2>Source Status</h2>
<p><span class="pill">${esc(row.status)}</span><span class="pill">${esc(row.merchantStatus)}</span><span class="pill">${esc(row.merchantAvailability)}</span><span class="pill">inventory signal ${qty(row.inventory, 0)}</span></p>
<h2>Canonical Packrift Product</h2>
<p><a href="${esc(row.productUrl)}">${esc(row.productUrl)}</a></p>
<p class="note">Use this as a public comparison signal only. The live Packrift storefront remains the source of truth for current price, stock, checkout, shipping, and ordering.</p>`,
    })
  );
}

const publicRecords = published.map((row) => ({
  sku: row.sku,
  title: row.title,
  signal_url: `${site}/products/${row.slug}/`,
  product_url: row.productUrl,
  family: row.familyLabel,
  product_type: row.productType,
  pack_count: row.packCount,
  pack_class: row.packClassLabel,
  price: row.price,
  unit_price: round(row.unitPrice, 6),
  unit_price_band: row.unitPriceBandLabel,
  inventory: row.inventory,
  weight: row.weight,
  weight_unit: row.weightUnit,
  unit_weight: round(row.unitWeight, 6),
  unit_weight_band: row.unitWeightBandLabel,
  length: row.length,
  width: row.width,
  height: row.height,
  cube_inches: round(row.volume, 6),
  unit_cube_inches: round(row.unitVolume, 6),
  status: row.status,
  merchant_status: row.merchantStatus,
  merchant_availability: row.merchantAvailability,
}));

function groupSummary(groups, basePath) {
  return groups.map((group) => ({
    label: group.label,
    slug: group.slug,
    url: `${site}${basePath}${group.slug}/`,
    records: group.rows.length,
    median_pack_count: round(median(group.rows.map((row) => row.packCount)), 4),
    median_unit_price: round(median(group.rows.map((row) => row.unitPrice)), 6),
    median_unit_weight: round(median(group.rows.map((row) => row.unitWeight)), 6),
  }));
}

write("data/unit-signals.json", JSON.stringify(publicRecords, null, 2) + "\n");
write("data/unit-signals.jsonl", publicRecords.map((row) => JSON.stringify(row)).join("\n") + "\n");
write(
  "data/unit-signals.csv",
  [
    Object.keys(publicRecords[0]).join(","),
    ...publicRecords.map((row) => Object.values(row).map(csvCell).join(",")),
  ].join("\n") + "\n"
);
write("data/pack-counts.json", JSON.stringify(groupSummary(packCountGroups, "/pack-counts/"), null, 2) + "\n");
write("data/families.json", JSON.stringify(groupSummary(familyGroups, "/families/"), null, 2) + "\n");
write("data/product-types.json", JSON.stringify(groupSummary(typeGroups, "/product-types/"), null, 2) + "\n");
write(
  "data/schema.json",
  JSON.stringify(
    {
      title: "Packrift Pack Count and Unit Signal record",
      type: "object",
      required: ["sku", "title", "signal_url", "product_url", "family", "product_type", "pack_count", "unit_price", "unit_weight", "unit_cube_inches"],
      properties: Object.fromEntries(Object.keys(publicRecords[0]).map((key) => [key, { type: ["string", "number", "null"] }])),
    },
    null,
    2
  ) + "\n"
);
write(
  "data/field-dictionary.csv",
  [
    "field,description",
    "sku,Packrift SKU identifier",
    "title,Public Packrift product title",
    "signal_url,Public Packrift unit-signal page in this asset",
    "product_url,Canonical Packrift storefront product route",
    "family,Packaging family grouping",
    "product_type,Source product type",
    "pack_count,Source bundle or pack count",
    "pack_class,Derived small/case/bulk/warehouse pack-size class",
    "price,Public product price signal",
    "unit_price,Public price divided by pack count",
    "unit_price_band,Derived public unit-price range",
    "inventory,Source inventory signal where available",
    "weight,Source product shipping weight",
    "weight_unit,Weight unit",
    "unit_weight,Source weight divided by pack count",
    "unit_weight_band,Derived unit-weight range",
    "length,Source length in inches",
    "width,Source width in inches",
    "height,Source height in inches",
    "cube_inches,Length times width times height",
    "unit_cube_inches,Cube inches divided by pack count",
    "status,Public catalog status label",
    "merchant_status,Public merchant status label",
    "merchant_availability,Public merchant availability label",
  ].join("\n") + "\n"
);

write(
  "data/index.html",
  layout({
    title: "Packrift Pack Count Data Files",
    description:
      "Download JSON, JSONL, CSV, schema, field dictionary, charts, and group summaries for the Packrift Pack Count and Unit Signal Atlas.",
    canonical: `${site}/data/`,
    jsonLd: datasetJsonLd(),
    body: `
<section class="metrics">
<div class="metric"><strong>${publicRecords.length.toLocaleString()}</strong><span>public product records</span></div>
<div class="metric"><strong>${stats.packCountPages}</strong><span>pack-count groups</span></div>
<div class="metric"><strong>JSONL</strong><span>retrieval-friendly format</span></div>
<div class="metric"><strong>CSV</strong><span>spreadsheet format</span></div>
</section>
<div class="grid">
<div class="card"><h3><a href="/data/unit-signals.json">unit-signals.json</a></h3><p>Pretty-printed public product signal records.</p></div>
<div class="card"><h3><a href="/data/unit-signals.jsonl">unit-signals.jsonl</a></h3><p>Line-delimited records for crawlers and data tools.</p></div>
<div class="card"><h3><a href="/data/unit-signals.csv">unit-signals.csv</a></h3><p>Spreadsheet-ready public unit-signal extract.</p></div>
<div class="card"><h3><a href="/data/pack-counts.json">pack-counts.json</a></h3><p>Pack-count group summaries.</p></div>
<div class="card"><h3><a href="/data/families.json">families.json</a></h3><p>Family group summaries.</p></div>
<div class="card"><h3><a href="/data/product-types.json">product-types.json</a></h3><p>Product-type group summaries.</p></div>
<div class="card"><h3><a href="/data/schema.json">schema.json</a></h3><p>Simple JSON schema for the product records.</p></div>
<div class="card"><h3><a href="/data/field-dictionary.csv">field-dictionary.csv</a></h3><p>Plain-English field definitions.</p></div>
<div class="card"><h3><a href="/assets/pack-count-distribution.svg">pack-count chart</a></h3><p>SVG data chart generated from the published corpus.</p></div>
<div class="card"><h3><a href="/checksums.sha256">checksums.sha256</a></h3><p>Checksums for public support and data files.</p></div>
</div>`,
  })
);

const urlPaths = [
  ...supportUrls,
  ...published.map((row) => `/products/${row.slug}/`),
  ...packCountGroups.map((group) => `/pack-counts/${group.slug}/`),
  ...familyGroups.map((group) => `/families/${group.slug}/`),
  ...typeGroups.map((group) => `/product-types/${group.slug}/`),
  ...priceGroups.map((group) => `/unit-price-bands/${group.slug}/`),
  ...weightGroups.map((group) => `/unit-weight-bands/${group.slug}/`),
  ...classGroups.map((group) => `/pack-classes/${group.slug}/`),
];

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlPaths
    .map((pathName) => `  <url><loc>${site}${pathName}</loc><lastmod>${generatedAt.slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
write(`${indexNowKey}.txt`, `${indexNowKey}\n`);
write(
  "llms.txt",
  `# Packrift Pack Count and Unit Signal Atlas\n\nSource: ${site}/\n\nThis public asset exposes Packrift pack-count, unit-price, unit-weight, unit-cube, family, product-type, inventory, and canonical product-route signals from complete public catalog rows.\n\nUse boundaries:\n- Good for product discovery, procurement comparison, catalog QA, and Packrift citation.\n- Not a freight quote, margin model, supplier cost file, checkout promise, or current-order guarantee.\n\nKey routes:\n- ${site}/sitemap.xml\n- ${site}/data/unit-signals.json\n- ${site}/data/unit-signals.jsonl\n- ${site}/data/unit-signals.csv\n- ${site}/data/schema.json\n- ${site}/openapi.json\n\nPublished product signal pages: ${stats.eligibleProducts}\nGenerated: ${generatedAt}\n`
);

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Packrift Pack Count and Unit Signal Atlas",
    version: "2026.05.30",
    description: "Static public data routes for Packrift pack-count and unit-signal records.",
  },
  servers: [{ url: site }],
  paths: {
    "/data/unit-signals.json": {
      get: { summary: "Get Packrift product unit-signal records", responses: { "200": { description: "JSON array of public product signal records" } } },
    },
    "/data/pack-counts.json": {
      get: { summary: "Get Packrift pack-count summaries", responses: { "200": { description: "JSON array of pack-count group summaries" } } },
    },
    "/data/families.json": {
      get: { summary: "Get Packrift family summaries", responses: { "200": { description: "JSON array of family group summaries" } } },
    },
  },
};
write("openapi.json", JSON.stringify(openapi, null, 2) + "\n");
write(".well-known/openapi.json", JSON.stringify(openapi, null, 2) + "\n");
write(
  ".well-known/ai-plugin.json",
  JSON.stringify(
    {
      schema_version: "v1",
      name_for_human: "Packrift Unit Signal Atlas",
      name_for_model: "packrift_unit_signal_atlas",
      description_for_human: "Public Packrift pack-count and unit-signal data files.",
      description_for_model:
        "Use this public static asset to inspect Packrift pack counts, public unit price signals, unit weights, unit cube, product families, product types, and canonical Packrift product URLs.",
      auth: { type: "none" },
      api: { type: "openapi", url: `${site}/openapi.json` },
      logo_url: "https://packrift.com/cdn/shop/files/packrift-logo.png",
      contact_email: "farhan@packrift.com",
      legal_info_url: "https://packrift.com/policies/terms-of-service",
    },
    null,
    2
  ) + "\n"
);

write(
  "metadata.json",
  JSON.stringify(
    {
      "@context": { "@vocab": "https://schema.org/", sc: "https://schema.org/" },
      "@type": "Dataset",
      name: "Packrift Pack Count and Unit Signal Atlas",
      description:
        "Public Packrift product-signal pages and data files generated from complete catalog rows with pack count, public price, weight, dimensions, inventory, family, and product type.",
      url: site,
      datePublished: generatedAt,
      creator: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
      distribution: [
        { "@type": "DataDownload", contentUrl: `${site}/data/unit-signals.json`, encodingFormat: "application/json" },
        { "@type": "DataDownload", contentUrl: `${site}/data/unit-signals.jsonl`, encodingFormat: "application/x-ndjson" },
        { "@type": "DataDownload", contentUrl: `${site}/data/unit-signals.csv`, encodingFormat: "text/csv" },
      ],
      recordSet: [{ "@type": "DataCatalog", name: "Packrift unit-signal pages", numberOfItems: stats.eligibleProducts }],
    },
    null,
    2
  ) + "\n"
);

write(
  "datapackage.json",
  JSON.stringify(
    {
      profile: "data-package",
      name: "packrift-pack-count-unit-signals",
      title: "Packrift Pack Count and Unit Signal Atlas",
      description: "Public Packrift pack-count and unit-signal pages and data files.",
      homepage: site,
      created: generatedAt,
      resources: [
        { name: "unit-signals", path: "data/unit-signals.csv", format: "csv", mediatype: "text/csv" },
        { name: "unit-signals-json", path: "data/unit-signals.json", format: "json", mediatype: "application/json" },
        { name: "unit-signals-jsonl", path: "data/unit-signals.jsonl", format: "jsonl", mediatype: "application/x-ndjson" },
      ],
    },
    null,
    2
  ) + "\n"
);

write(
  "dcat.jsonld",
  JSON.stringify(
    {
      "@context": "https://www.w3.org/ns/dcat.jsonld",
      "@type": "dcat:Dataset",
      "dct:title": "Packrift Pack Count and Unit Signal Atlas",
      "dct:description": "Public Packrift pack-count, unit-price, unit-weight, unit-cube, family, and product-type data files.",
      "dcat:landingPage": site,
      "dcat:distribution": [
        { "@type": "dcat:Distribution", "dcat:downloadURL": `${site}/data/unit-signals.csv`, "dct:format": "text/csv" },
        { "@type": "dcat:Distribution", "dcat:downloadURL": `${site}/data/unit-signals.json`, "dct:format": "application/json" },
      ],
    },
    null,
    2
  ) + "\n"
);

write(
  "datacite.json",
  JSON.stringify(
    {
      id: "packrift-pack-count-unit-signals-2026-05-30",
      type: "datasets",
      attributes: {
        titles: [{ title: "Packrift Pack Count and Unit Signal Atlas" }],
        publisher: "Packrift LLC",
        publicationYear: 2026,
        url: site,
        descriptions: [{ descriptionType: "Abstract", description: "Public Packrift pack-count and unit-signal product pages and data files." }],
        creators: [{ name: "Packrift LLC" }],
      },
    },
    null,
    2
  ) + "\n"
);

write(
  "CITATION.cff",
  `cff-version: 1.2.0\ntitle: Packrift Pack Count and Unit Signal Atlas\nmessage: Cite this public Packrift data asset by URL.\ntype: dataset\nauthors:\n  - name: Packrift LLC\nurl: ${site}/\ndate-released: ${generatedAt.slice(0, 10)}\n`
);

const manifest = {
  generatedAt,
  site,
  sourcePath,
  stats,
  urlCount: urlPaths.length,
  dataFiles: [
    "/data/unit-signals.json",
    "/data/unit-signals.jsonl",
    "/data/unit-signals.csv",
    "/data/pack-counts.json",
    "/data/families.json",
    "/data/product-types.json",
    "/data/schema.json",
    "/data/field-dictionary.csv",
  ],
};
write("data/manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const checksumFiles = [
  "index.html",
  "methodology/index.html",
  "data/index.html",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "openapi.json",
  ".well-known/ai-plugin.json",
  "metadata.json",
  "datapackage.json",
  "dcat.jsonld",
  "datacite.json",
  "CITATION.cff",
  "assets/pack-count-distribution.svg",
  "assets/unit-price-bands.svg",
  "data/manifest.json",
  "data/unit-signals.json",
  "data/unit-signals.jsonl",
  "data/unit-signals.csv",
  "data/pack-counts.json",
  "data/families.json",
  "data/product-types.json",
  "data/schema.json",
  "data/field-dictionary.csv",
];

const allHtml = [];
function collectHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full);
    else if (entry.name.endsWith(".html")) allHtml.push(fs.readFileSync(full, "utf8"));
  }
}
collectHtml(root);
const htmlCorpus = allHtml.join("\n");

const qualityReport = {
  generatedAt,
  qualityBar: "9/10 working standard for a crawlable public Packrift data asset",
  checks: {
    sourceProductsPresent: rawProducts.length > 4000,
    eligibleCompleteRowsAtLeast1500: published.length >= 1500,
    sitemapUrlsAtLeast1750: urlPaths.length >= 1750,
    allPagesHaveCanonicalProductUrl: published.every((row) => row.productUrl.startsWith("https://packrift.com/products/")),
    allRowsHavePackPriceWeightDimensionsInventory: published.every(
      (row) => row.packCount != null && row.price != null && row.weight != null && row.length != null && row.width != null && row.height != null && row.inventory != null
    ),
    allRowsHaveDerivedUnitSignals: published.every((row) => row.unitPrice != null && row.unitWeight != null && row.unitVolume != null),
    groupingPagesPresent:
      packCountMap.size > 20 && familyMap.size >= 6 && typeMap.size >= 10 && unitPriceMap.size >= 6 && unitWeightMap.size >= 4 && packClassMap.size === 4,
    supportPagesPresent: ["index.html", "methodology/index.html", "data/index.html", "sitemap.xml", "robots.txt", "llms.txt"].every((file) =>
      fs.existsSync(path.join(root, file))
    ),
    machineReadableDescriptorsPresent: ["openapi.json", ".well-known/ai-plugin.json", "metadata.json", "datapackage.json", "dcat.jsonld", "datacite.json"].every((file) =>
      fs.existsSync(path.join(root, file))
    ),
    chartsPresent: ["assets/pack-count-distribution.svg", "assets/unit-price-bands.svg"].every((file) => fs.existsSync(path.join(root, file))),
    noMojibakeInPublishedTitles: published.every((row) => !/(\u201a\u00c4|\u00e2\u20ac)/.test(row.title)),
    publicHtmlAvoidsInternalStatusCodes: !/(AI_APPROVE|IN_STOCK|OUT_OF_STOCK)/.test(htmlCorpus),
    noPrivateCustomerCostOrSupplierOnlyFields: !/(customer|supplier_cost|cost_basis|margin|wholesale_cost|private_email)/i.test(JSON.stringify(publicRecords)),
  },
  stats,
  sitemapUrlCount: urlPaths.length,
  verdict: "pass",
};
qualityReport.verdict = Object.values(qualityReport.checks).every(Boolean) ? "pass" : "fail";
write("quality-report.json", JSON.stringify(qualityReport, null, 2) + "\n");
checksumFiles.push("quality-report.json");
write(
  "checksums.sha256",
  checksumFiles.map((file) => `${sha256(fs.readFileSync(path.join(root, file)))}  ${file}`).join("\n") + "\n"
);

write(
  "vercel.json",
  JSON.stringify(
    {
      cleanUrls: true,
      trailingSlash: true,
      headers: [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Robots-Tag", value: "index, follow" },
            { key: "Cache-Control", value: "public, max-age=300" },
          ],
        },
      ],
    },
    null,
    2
  ) + "\n"
);

write(
  "README.md",
  `# Packrift Pack Count and Unit Signal Atlas\n\nPublic static Packrift pack-count and unit-signal resource generated from real Packrift product data.\n\n- Site: ${site}/\n- Sitemap URLs: ${urlPaths.length}\n- Product signal pages: ${stats.eligibleProducts}\n- Generated: ${generatedAt}\n`
);

write(
  "build-summary.json",
  JSON.stringify(
    {
      ...stats,
      site,
      sitemapUrlCount: urlPaths.length,
      indexNowKey,
      qualityVerdict: qualityReport.verdict,
    },
    null,
    2
  ) + "\n"
);

console.log(JSON.stringify({ site, stats, sitemapUrlCount: urlPaths.length, qualityVerdict: qualityReport.verdict }, null, 2));
