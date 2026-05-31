import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath =
  process.env.PRODUCTS_JSON ||
  "/Users/farhan/Downloads/packrift-backlinks/execution/packrift-operations-resource-graph-2026-05-28/data/products.json";
const site = "https://packrift.github.io/sku-evidence-cards";
const generatedAt = new Date().toISOString();
const agentManifestUpdatedAt = "2026-05-31T19:22:56Z";
const indexNowKey = "7d4ea0e32d6f4924b35d7b8c4e3a95f1";
const maxSkuPages = 1200;

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
      .slice(0, 140) || "packrift"
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

function publicStatus(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "source review";
  if (raw === "AI_APPROVE" || raw === "APPROVED") return "catalog approved";
  return raw.toLowerCase().replace(/_/g, " ");
}

function publicAvailability(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "IN_STOCK") return "in stock";
  if (raw === "OUT_OF_STOCK") return "out of stock";
  return raw.toLowerCase().replace(/_/g, " ");
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  const n = number(value);
  return n == null ? "source missing" : `$${n.toFixed(2)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function priceBand(value) {
  const n = number(value);
  if (n == null) return "unknown";
  if (n < 25) return "under-25";
  if (n < 75) return "25-to-75";
  if (n < 200) return "75-to-200";
  return "200-plus";
}

function weightBand(value) {
  const n = number(value);
  if (n == null) return "unknown";
  if (n < 1) return "sub-1-lb";
  if (n < 10) return "1-to-10-lb";
  if (n < 50) return "10-to-50-lb";
  return "50-plus-lb";
}

function completeness(row) {
  const checks = [
    row.sku,
    row.title,
    row.productUrl,
    row.productType,
    row.family,
    row.price != null,
    row.inventory != null,
    row.weight != null,
    row.length != null && row.width != null && row.height != null,
    row.merchantAvailability,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalize(row, index, seen) {
  const sku = String(row.sku || `row-${index + 1}`).trim();
  const title = cleanText(row.title || sku);
  const handle = cleanText(row.handle || row.productUrl?.split("/").filter(Boolean).pop() || title);
  const baseSlug = `${slugify(sku)}-${slugify(handle)}`.slice(0, 170);
  const duplicate = seen.get(baseSlug) || 0;
  seen.set(baseSlug, duplicate + 1);
  const slug = duplicate ? `${baseSlug}-${duplicate + 1}` : baseSlug;
  const dims = [row.length, row.width, row.height].map(number);
  const volume = dims.every((x) => x != null) ? dims[0] * dims[1] * dims[2] : null;
  const weight = number(row.weight);
  const price = number(row.price);
  return {
    id: index + 1,
    slug,
    sku,
    offerId: row.offerId || "",
    productId: row.productId || "",
    variantId: row.variantId || "",
    handle,
    title,
    family: cleanText(row.family || "packaging"),
    familyLabel: cleanText(row.familyLabel || row.family || "packaging"),
    productType: cleanText(row.productType || "Packaging"),
    productUrl: row.productUrl || "",
    price,
    priceBand: priceBand(price),
    inventory: number(row.inventory),
    weight,
    weightUnit: row.weightUnit || "POUNDS",
    weightBand: weightBand(weight),
    length: dims[0],
    width: dims[1],
    height: dims[2],
    volume,
    packCount: number(row.packCount),
    statusRaw: row.status || "source_review",
    status: publicStatus(row.status || "source_review"),
    merchantStatusRaw: row.merchantStatus || "",
    merchantStatus: publicStatus(row.merchantStatus || ""),
    merchantAvailabilityRaw: row.merchantAvailability || "",
    merchantAvailability: publicAvailability(row.merchantAvailability || ""),
    imageStatus: publicStatus(row.imageStatus || ""),
    dimensionsStatus: publicStatus(row.dimensionsStatus || ""),
    missing: Array.isArray(row.missing) ? row.missing : [],
    completeness: 0,
  };
}

const rawProducts = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const seen = new Map();
const products = rawProducts
  .map((row, index) => normalize(row, index, seen))
  .filter((row) => row.sku && row.productUrl && row.title)
  .map((row) => ({ ...row, completeness: completeness(row) }))
  .sort((a, b) => {
    const status = Number(b.statusRaw === "AI_APPROVE") - Number(a.statusRaw === "AI_APPROVE");
    if (status) return status;
    const stock = Number(b.merchantAvailabilityRaw === "IN_STOCK") - Number(a.merchantAvailabilityRaw === "IN_STOCK");
    if (stock) return stock;
    return b.completeness - a.completeness || a.sku.localeCompare(b.sku);
  });

const published = products.slice(0, maxSkuPages);

const familyMap = new Map();
const statusMap = new Map();
const priceMap = new Map();
for (const row of published) {
  const familySlug = slugify(row.familyLabel);
  const statusSlug = slugify(row.status);
  const priceSlug = row.priceBand;
  if (!familyMap.has(familySlug)) familyMap.set(familySlug, { slug: familySlug, label: row.familyLabel, rows: [] });
  if (!statusMap.has(statusSlug)) statusMap.set(statusSlug, { slug: statusSlug, label: row.status, rows: [] });
  if (!priceMap.has(priceSlug)) priceMap.set(priceSlug, { slug: priceSlug, label: row.priceBand, rows: [] });
  familyMap.get(familySlug).rows.push(row);
  statusMap.get(statusSlug).rows.push(row);
  priceMap.get(priceSlug).rows.push(row);
}

const stats = {
  generatedAt,
  sourcePath,
  sourceProducts: rawProducts.length,
  eligibleProducts: products.length,
  publishedSkuCards: published.length,
  familyPages: familyMap.size,
  statusPages: statusMap.size,
  priceBandPages: priceMap.size,
  inStockCards: published.filter((row) => row.merchantAvailabilityRaw === "IN_STOCK").length,
  completeCards: published.filter((row) => row.completeness >= 90).length,
};

const css = `
:root { color-scheme: light; --ink:#18211b; --muted:#5b665e; --line:#d9e0d8; --paper:#fbfcf7; --panel:#ffffff; --soft:#edf3ec; --accent:#28633b; --accent2:#77542a; }
* { box-sizing:border-box; }
html, body { overflow-x:hidden; }
body { margin:0; background:var(--paper); color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.5; }
a { color:var(--accent); text-underline-offset:.18em; overflow-wrap:anywhere; }
header { max-width:100vw; background:#fff; border-bottom:1px solid var(--line); padding:30px 20px 24px; }
main { max-width:min(1180px,100vw); padding:28px 20px 54px; }
footer { border-top:1px solid var(--line); padding:24px 20px; color:var(--muted); font-size:13px; }
.kicker { font-size:12px; font-weight:800; color:var(--accent2); text-transform:uppercase; letter-spacing:0; }
h1 { margin:8px 0 12px; max-width:100%; font-size:26px; line-height:1.08; letter-spacing:0; overflow-wrap:anywhere; }
h2 { margin:34px 0 12px; font-size:24px; letter-spacing:0; }
h3 { margin:22px 0 8px; font-size:18px; letter-spacing:0; }
p { max-width:100%; color:var(--muted); overflow-wrap:anywhere; }
header p, h1, .grid { max-width:340px; }
.metrics { display:grid; grid-template-columns:1fr; gap:12px; margin:22px 0; max-width:340px; }
.metric, .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
.metric strong { display:block; color:var(--ink); font-size:25px; }
.grid { display:grid; grid-template-columns:1fr; gap:12px; }
.table-wrap { max-width:340px; overflow:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
table { width:100%; min-width:820px; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px solid var(--line); }
th { background:var(--soft); color:#27372d; }
.pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:2px 8px; margin:2px 4px 2px 0; font-size:12px; background:#fff; color:#334238; }
.note { max-width:340px; padding:12px 14px; border-left:4px solid var(--accent); background:var(--soft); color:#334238; }
.score { color:var(--accent); font-weight:800; }
@media (min-width: 560px) {
  header { padding:30px min(6vw,56px) 24px; }
  main { padding:28px min(6vw,56px) 54px; }
  footer { padding:24px min(6vw,56px); }
  header p { max-width:850px; }
  h1 { max-width:980px; font-size:clamp(30px,5vw,52px); line-height:1.03; }
  .metrics { max-width:980px; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
  .grid { max-width:none; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); }
  .table-wrap { max-width:100%; }
  .note { max-width:900px; }
}
`;

function layout({ title, description, canonical, body, jsonLd }) {
  const structured = jsonLd
    ? `<script type="application/ld+json">${js(jsonLd)}</script>`
    : "";
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
<div class="kicker">Packrift SKU evidence cards</div>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
</header>
<main>${body}</main>
<footer>Generated ${esc(generatedAt)} from Packrift public catalog and operations-product data. These evidence cards support packaging discovery, procurement review, and agent-readable citation. They are not freight quotes or checkout promises.</footer>
</body>
</html>`;
}

function table(rows) {
  return `<div class="table-wrap"><table>
<thead><tr><th>SKU</th><th>Packrift title</th><th>Family</th><th>Price</th><th>Weight</th><th>Evidence</th></tr></thead>
<tbody>
${rows
  .map(
    (row) => `<tr>
<td><a href="/sku/${row.slug}/">${esc(row.sku)}</a></td>
<td>${esc(row.title)}</td>
<td>${esc(row.familyLabel)}</td>
<td>${money(row.price)}</td>
<td>${row.weight == null ? "source missing" : `${row.weight} ${esc(row.weightUnit)}`}</td>
<td><span class="pill">${esc(row.status)}</span><span class="pill">${esc(row.merchantAvailability || "availability missing")}</span><span class="pill">${row.completeness}% complete</span></td>
</tr>`
  )
  .join("\n")}
</tbody></table></div>`;
}

function datasetJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Packrift SKU Evidence Cards",
    description:
      "Public Packrift SKU evidence cards and data files generated from real Packrift catalog fields for procurement and agent-readable discovery.",
    url: site,
    creator: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
    license: "https://packrift.com/policies/terms-of-service",
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${site}/data/products.json` },
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${site}/data/products.jsonl` },
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${site}/data/products.csv` },
    ],
  };
}

function productJsonLd(row) {
  const offer = row.price == null
    ? undefined
    : {
        "@type": "Offer",
        priceCurrency: "USD",
        price: row.price,
        availability:
          row.merchantAvailabilityRaw === "IN_STOCK"
            ? "https://schema.org/InStock"
            : "https://schema.org/LimitedAvailability",
        url: row.productUrl,
      };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: row.title,
    sku: row.sku,
    brand: { "@type": "Brand", name: "Packrift" },
    category: row.productType,
    url: row.productUrl,
    offers: offer,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Packrift evidence card", value: `${site}/sku/${row.slug}/` },
      { "@type": "PropertyValue", name: "Family", value: row.familyLabel },
      { "@type": "PropertyValue", name: "Completeness score", value: `${row.completeness}` },
      { "@type": "PropertyValue", name: "Weight", value: row.weight == null ? "source missing" : `${row.weight} ${row.weightUnit}` },
      { "@type": "PropertyValue", name: "Dimensions", value: row.volume == null ? "source missing" : `${row.length} x ${row.width} x ${row.height} in` },
    ],
  };
}

ensureDir("sku");
ensureDir("families");
ensureDir("status");
ensureDir("price-bands");
ensureDir("data");
ensureDir(".well-known");

const supportUrls = [
  "/",
  "/methodology/",
  "/data/",
  "/data/manifest.json",
  "/data/products.json",
  "/data/products.jsonl",
  "/data/products.csv",
  "/data/families.json",
  "/data/schema.json",
  "/data/field-dictionary.csv",
  "/openapi.json",
  "/.well-known/openapi.json",
  "/.well-known/ai-plugin.json",
  "/agent-manifest.json",
  "/.well-known/agent-manifest.json",
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

function agentManifest() {
  const representativeSku = published[0]?.slug;
  const representativeFamily = [...familyMap.values()].sort((a, b) => b.rows.length - a.rows.length)[0]?.slug;
  return {
    spec_version: "agentmanifest-0.3",
    name: "Packrift SKU Evidence Cards",
    version: "1.0.1",
    description:
      "Packrift SKU Evidence Cards is a free, no-auth public reference asset for Packrift catalog evidence. It exposes SKU pages, family indexes, source-completeness signals, public product routes, price bands, inventory signals, dimensions, weights, and machine-readable sidecars for packaging procurement and agent-readable citation without claiming live freight, checkout, or supplier-cost data.",
    homepage: `${site}/`,
    documentation: `${site}/llms.txt`,
    categories: ["commerce", "logistics", "engineering", "computing"],
    primary_category: "reference",
    endpoints: [
      {
        path: "/llms.txt",
        method: "GET",
        description: "Fetch the compact agent-readable route map, source boundaries, and use limits.",
        parameters: [],
        response_description: "Plain text guide covering canonical URLs, public data routes, safe-use notes, and generated counts.",
      },
      {
        path: "/openapi.json",
        method: "GET",
        description: "Fetch the OpenAPI map for public SKU evidence-card data routes.",
        parameters: [],
        response_description: "OpenAPI 3.1 document for read-only product and family data files.",
      },
      {
        path: "/sitemap.xml",
        method: "GET",
        description: "Enumerate crawlable SKU evidence pages, family/status/price pages, and support sidecars.",
        parameters: [],
        response_description: "XML sitemap with static support paths and generated Packrift evidence-card pages.",
      },
      {
        path: "/data/products.json",
        method: "GET",
        description: "Download normalized Packrift public SKU evidence records.",
        parameters: [],
        response_description: "JSON array of public records with SKU, title, evidence URL, product URL, family, price, inventory, dimensions, weight, status, and completeness fields.",
      },
      {
        path: "/data/families.json",
        method: "GET",
        description: "Download family-level summaries for Packrift evidence-card coverage.",
        parameters: [],
        response_description: "JSON array of Packrift family summaries with URLs and card counts.",
      },
      {
        path: "/data/schema.json",
        method: "GET",
        description: "Fetch the JSON schema for the public SKU evidence records.",
        parameters: [],
        response_description: "JSON schema describing required and optional product evidence fields.",
      },
      {
        path: representativeFamily ? `/families/${representativeFamily}/` : "/data/",
        method: "GET",
        description: "Read a representative family evidence-card index page.",
        parameters: [],
        response_description: "HTML family page listing Packrift public evidence cards in that packaging family.",
      },
      {
        path: representativeSku ? `/sku/${representativeSku}/` : "/data/products.json",
        method: "GET",
        description: "Read a representative Packrift SKU evidence card.",
        parameters: [],
        response_description: "HTML SKU evidence-card page with public product facts, physical signals, source-completeness status, and canonical Packrift product route.",
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
    agent_notes: `Use this manifest as a read-only entry point for Packrift SKU evidence across ${stats.publishedSkuCards} public SKU cards, ${stats.familyPages} family pages, ${stats.statusPages} status pages, and ${stats.priceBandPages} price-band pages. Access is free, and no account, credential, token, API key, payment, checkout, carrier account, or password is required for the public files listed here. Do not treat static evidence-card records as live freight quotes, supplier-cost disclosures, inventory promises, substitute approvals, or checkout/order completion. Use Packrift.com and Packrift MCP for live price, inventory, freight, cart, and buyer-specific checks.`,
    contact: {
      email: "farhan@packrift.com",
      support_url: "https://packrift.com/pages/contact",
      github: "https://github.com/Packrift",
    },
    listing_requested: true,
    last_updated: agentManifestUpdatedAt,
  };
}

const rootBody = `
<section class="metrics">
<div class="metric"><strong>${stats.publishedSkuCards.toLocaleString()}</strong>public SKU evidence cards</div>
<div class="metric"><strong>${stats.familyPages}</strong>family indexes</div>
<div class="metric"><strong>${stats.inStockCards.toLocaleString()}</strong>in-stock card rows</div>
<div class="metric"><strong>${stats.completeCards.toLocaleString()}</strong>complete evidence cards</div>
</section>
<p class="note">This asset is a public evidence layer for real Packrift SKU metadata. It separates product facts, source completeness, family grouping, price band, inventory signal, and machine-readable data sidecars so buyers and agents can cite Packrift catalog rows without guessing.</p>
<h2>Browse Families</h2>
<div class="grid">
${[...familyMap.values()]
  .sort((a, b) => b.rows.length - a.rows.length)
  .map((group) => `<div class="card"><h3><a href="/families/${group.slug}/">${esc(group.label)}</a></h3><p>${group.rows.length} public evidence cards.</p></div>`)
  .join("\n")}
</div>
<h2>Recent Evidence Cards</h2>
${table(published.slice(0, 40))}
<h2>Data Access</h2>
<div class="grid">
<div class="card"><h3><a href="/data/products.json">JSON</a></h3><p>Normalized SKU evidence records.</p></div>
<div class="card"><h3><a href="/data/products.jsonl">JSONL</a></h3><p>Line-oriented records for crawlers and data tools.</p></div>
<div class="card"><h3><a href="/data/products.csv">CSV</a></h3><p>Spreadsheet-ready field extract.</p></div>
<div class="card"><h3><a href="/llms.txt">llms.txt</a></h3><p>Agent-readable route map and usage boundaries.</p></div>
<div class="card"><h3><a href="/.well-known/agent-manifest.json">Agent Manifest</a></h3><p>Public Agent Manifest Protocol descriptor for this asset.</p></div>
</div>`;

write(
  "index.html",
  layout({
    title: "Packrift SKU Evidence Cards",
    description:
      "A public Packrift catalog evidence layer with SKU cards, family indexes, source-completeness signals, data files, and agent-readable descriptors.",
    canonical: `${site}/`,
    body: rootBody,
    jsonLd: datasetJsonLd(),
  })
);

write(
  "methodology/index.html",
  layout({
    title: "Packrift SKU Evidence Methodology",
    description:
      "How the Packrift SKU Evidence Cards are generated, what fields are included, and how the asset avoids claims beyond the source data.",
    canonical: `${site}/methodology/`,
    body: `<h2>Source Boundary</h2><p>The source is the cleaned Packrift operations product graph, derived from Packrift Merchant Center and storefront product fields. Cost, supplier-only, and private customer data are excluded.</p><h2>Counted Evidence</h2><p>Each card is counted only as an owned Packrift public URL. Third-party profiles or discovery receipts are counted separately only after direct public verification.</p><h2>Use Limits</h2><p>Cards summarize product metadata for discovery and review. They are not freight quotes, checkout commitments, or product availability guarantees outside the live Packrift storefront.</p>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: "Packrift SKU Evidence Methodology",
      about: "Packrift public SKU data evidence generation",
      publisher: { "@type": "Organization", name: "Packrift LLC" },
    },
  })
);

write(
  "data/index.html",
  layout({
    title: "Packrift SKU Evidence Data Files",
    description:
      "Download the machine-readable JSON, JSONL, CSV, schema, field dictionary, and manifest for the Packrift SKU Evidence Cards asset.",
    canonical: `${site}/data/`,
    body: `
<section class="metrics">
<div class="metric"><strong>${stats.publishedSkuCards.toLocaleString()}</strong>SKU records</div>
<div class="metric"><strong>${stats.familyPages}</strong>family summaries</div>
<div class="metric"><strong>JSON</strong>primary format</div>
<div class="metric"><strong>CSV</strong>spreadsheet format</div>
</section>
<div class="grid">
<div class="card"><h3><a href="/data/products.json">products.json</a></h3><p>Pretty-printed public Packrift SKU evidence records.</p></div>
<div class="card"><h3><a href="/data/products.jsonl">products.jsonl</a></h3><p>Line-delimited records for crawlers, retrieval systems, and data tooling.</p></div>
<div class="card"><h3><a href="/data/products.csv">products.csv</a></h3><p>Spreadsheet-ready public evidence extract.</p></div>
<div class="card"><h3><a href="/data/families.json">families.json</a></h3><p>Family-level public evidence summaries.</p></div>
<div class="card"><h3><a href="/data/schema.json">schema.json</a></h3><p>Simple JSON schema for the product evidence records.</p></div>
<div class="card"><h3><a href="/data/field-dictionary.csv">field-dictionary.csv</a></h3><p>Plain-English field definitions for humans and agents.</p></div>
<div class="card"><h3><a href="/data/manifest.json">manifest.json</a></h3><p>Generation time, source boundary, counts, and route inventory.</p></div>
<div class="card"><h3><a href="/checksums.sha256">checksums.sha256</a></h3><p>Checksums for the public support and data files.</p></div>
</div>`,
    jsonLd: datasetJsonLd(),
  })
);

for (const row of published) {
  write(
    `sku/${row.slug}/index.html`,
    layout({
      title: `${row.sku} Packrift SKU Evidence Card`,
      description: `${row.title} evidence card with Packrift family, availability, price band, dimensions, weight, and source-completeness status.`,
      canonical: `${site}/sku/${row.slug}/`,
      body: `
<section class="metrics">
<div class="metric"><strong>${esc(row.sku)}</strong>Packrift SKU</div>
<div class="metric"><strong>${row.completeness}%</strong>source completeness</div>
<div class="metric"><strong>${esc(row.merchantAvailability || "unknown")}</strong>availability signal</div>
<div class="metric"><strong>${money(row.price)}</strong>public price signal</div>
</section>
<h2>Product Evidence</h2>
<div class="grid">
<div class="card"><h3>Packrift title</h3><p>${esc(row.title)}</p></div>
<div class="card"><h3>Family</h3><p><a href="/families/${slugify(row.familyLabel)}/">${esc(row.familyLabel)}</a></p></div>
<div class="card"><h3>Product type</h3><p>${esc(row.productType)}</p></div>
<div class="card"><h3>Status</h3><p><span class="pill">${esc(row.status)}</span><span class="pill">${esc(row.merchantStatus)}</span></p></div>
</div>
<h2>Physical Signals</h2>
<div class="grid">
<div class="card"><h3>Dimensions</h3><p>${row.volume == null ? "source missing" : `${row.length} x ${row.width} x ${row.height} in`}</p></div>
<div class="card"><h3>Weight</h3><p>${row.weight == null ? "source missing" : `${row.weight} ${esc(row.weightUnit)}`}</p></div>
<div class="card"><h3>Pack count</h3><p>${row.packCount == null ? "source missing" : row.packCount}</p></div>
<div class="card"><h3>Inventory signal</h3><p>${row.inventory == null ? "source missing" : row.inventory.toLocaleString()}</p></div>
</div>
<h2>Canonical Product Route</h2>
<p><a href="${esc(row.productUrl)}">${esc(row.productUrl)}</a></p>
<h2>Machine-readable Status</h2>
<p><span class="pill">${esc(row.priceBand)}</span><span class="pill">${esc(row.weightBand)}</span><span class="pill">${esc(row.imageStatus || "image status missing")}</span><span class="pill">${esc(row.dimensionsStatus || "dimension status missing")}</span></p>`,
      jsonLd: productJsonLd(row),
    })
  );
}

for (const group of familyMap.values()) {
  write(
    `families/${group.slug}/index.html`,
    layout({
      title: `Packrift ${group.label} SKU Evidence`,
      description: `${group.rows.length} Packrift public SKU evidence cards in the ${group.label} family.`,
      canonical: `${site}/families/${group.slug}/`,
      body: `<section class="metrics"><div class="metric"><strong>${group.rows.length}</strong>cards</div><div class="metric"><strong>${group.rows.filter((row) => row.merchantAvailabilityRaw === "IN_STOCK").length}</strong>in stock</div></section>${table(group.rows)}`,
      jsonLd: datasetJsonLd(),
    })
  );
}

for (const group of statusMap.values()) {
  write(
    `status/${group.slug}/index.html`,
    layout({
      title: `Packrift ${group.label} SKU Evidence`,
      description: `${group.rows.length} Packrift SKU evidence cards grouped by source status ${group.label}.`,
      canonical: `${site}/status/${group.slug}/`,
      body: table(group.rows),
      jsonLd: datasetJsonLd(),
    })
  );
}

for (const group of priceMap.values()) {
  write(
    `price-bands/${group.slug}/index.html`,
    layout({
      title: `Packrift ${group.label} Price Band Evidence`,
      description: `${group.rows.length} Packrift SKU evidence cards grouped by public price band ${group.label}.`,
      canonical: `${site}/price-bands/${group.slug}/`,
      body: table(group.rows),
      jsonLd: datasetJsonLd(),
    })
  );
}

const publicRecords = published.map((row) => ({
  sku: row.sku,
  title: row.title,
  evidence_url: `${site}/sku/${row.slug}/`,
  product_url: row.productUrl,
  family: row.familyLabel,
  product_type: row.productType,
  price: row.price,
  price_band: row.priceBand,
  inventory: row.inventory,
  weight: row.weight,
  weight_unit: row.weightUnit,
  weight_band: row.weightBand,
  length: row.length,
  width: row.width,
  height: row.height,
  pack_count: row.packCount,
  status: row.status,
  merchant_status: row.merchantStatus,
  merchant_availability: row.merchantAvailability,
  completeness: row.completeness,
}));

const families = [...familyMap.values()].map((group) => ({
  family: group.label,
  slug: group.slug,
  url: `${site}/families/${group.slug}/`,
  cards: group.rows.length,
  in_stock: group.rows.filter((row) => row.merchantAvailability === "IN_STOCK").length,
}));

write("data/products.json", JSON.stringify(publicRecords, null, 2) + "\n");
write("data/products.jsonl", publicRecords.map((row) => JSON.stringify(row)).join("\n") + "\n");
write(
  "data/products.csv",
  [
    Object.keys(publicRecords[0]).join(","),
    ...publicRecords.map((row) => Object.values(row).map(csvCell).join(",")),
  ].join("\n") + "\n"
);
write("data/families.json", JSON.stringify(families, null, 2) + "\n");
write(
  "data/schema.json",
  JSON.stringify(
    {
      title: "Packrift SKU Evidence Card",
      type: "object",
      required: ["sku", "title", "evidence_url", "product_url", "family", "status", "completeness"],
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
    "evidence_url,Public evidence-card URL in this asset",
    "product_url,Canonical Packrift storefront product route",
    "family,Packaging family grouping",
    "product_type,Source product type",
    "price,Public price signal from source data",
    "price_band,Derived price range bucket",
    "inventory,Source inventory signal where available",
    "weight,Source product shipping weight",
    "weight_unit,Weight unit",
    "weight_band,Derived weight range bucket",
    "length,Source length in inches where available",
    "width,Source width in inches where available",
    "height,Source height in inches where available",
    "pack_count,Source bundle or pack count where parsed",
    "status,Packrift source review status",
    "merchant_status,Merchant source status",
    "merchant_availability,Merchant source availability signal",
    "completeness,Percentage of included public evidence fields present",
  ].join("\n") + "\n"
);

const urlPaths = [
  ...supportUrls,
  ...published.map((row) => `/sku/${row.slug}/`),
  ...[...familyMap.values()].map((group) => `/families/${group.slug}/`),
  ...[...statusMap.values()].map((group) => `/status/${group.slug}/`),
  ...[...priceMap.values()].map((group) => `/price-bands/${group.slug}/`),
];

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlPaths
    .map((pathName) => `  <url><loc>${site}${pathName}</loc><lastmod>${generatedAt.slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
write(indexNowKey + ".txt", indexNowKey + "\n");
write(
  "llms.txt",
  `# Packrift SKU Evidence Cards\n\nSource: ${site}/\n\nThis public asset exposes Packrift SKU evidence cards from real public catalog fields. Use it for procurement review, product discovery, and agent citation. Do not treat it as a freight quote or order commitment.\n\nKey routes:\n- ${site}/sitemap.xml\n- ${site}/data/products.json\n- ${site}/data/products.jsonl\n- ${site}/data/products.csv\n- ${site}/data/schema.json\n- ${site}/openapi.json\n- ${site}/.well-known/agent-manifest.json\n\nPublished cards: ${stats.publishedSkuCards}\nGenerated: ${generatedAt}\n`
);

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Packrift SKU Evidence Cards",
    version: "2026.05.30",
    description: "Static public data routes for Packrift SKU evidence cards.",
  },
  servers: [{ url: site }],
  paths: {
    "/data/products.json": {
      get: {
        summary: "Get Packrift SKU evidence cards",
        responses: { "200": { description: "JSON array of public evidence records" } },
      },
    },
    "/data/families.json": {
      get: {
        summary: "Get Packrift family evidence summary",
        responses: { "200": { description: "JSON array of family summary records" } },
      },
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
      name_for_human: "Packrift SKU Evidence Cards",
      name_for_model: "packrift_sku_evidence_cards",
      description_for_human: "Public Packrift SKU evidence cards and data files.",
      description_for_model:
        "Use this public static asset to inspect Packrift SKU evidence-card metadata, product routes, family groups, and source-completeness signals.",
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

const amp = agentManifest();
write("agent-manifest.json", JSON.stringify(amp, null, 2) + "\n");
write(".well-known/agent-manifest.json", JSON.stringify(amp, null, 2) + "\n");

write(
  "metadata.json",
  JSON.stringify(
    {
      "@context": {
        "@vocab": "https://schema.org/",
        sc: "https://schema.org/",
        cr: "http://mlcommons.org/croissant/",
      },
      "@type": "Dataset",
      name: "Packrift SKU Evidence Cards",
      description:
        "Public Packrift SKU evidence cards generated from real Packrift product data for procurement, search, and agent-readable discovery.",
      url: site,
      datePublished: generatedAt,
      creator: { "@type": "Organization", name: "Packrift LLC", url: "https://packrift.com/" },
      distribution: [
        { "@type": "DataDownload", contentUrl: `${site}/data/products.json`, encodingFormat: "application/json" },
        { "@type": "DataDownload", contentUrl: `${site}/data/products.jsonl`, encodingFormat: "application/x-ndjson" },
        { "@type": "DataDownload", contentUrl: `${site}/data/products.csv`, encodingFormat: "text/csv" },
      ],
      recordSet: [{ "@type": "DataCatalog", name: "SKU evidence cards", numberOfItems: stats.publishedSkuCards }],
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
      name: "packrift-sku-evidence-cards",
      title: "Packrift SKU Evidence Cards",
      description: "Public Packrift SKU evidence cards and data files.",
      homepage: site,
      created: generatedAt,
      resources: [
        { name: "products", path: "data/products.csv", format: "csv", mediatype: "text/csv" },
        { name: "products-json", path: "data/products.json", format: "json", mediatype: "application/json" },
        { name: "products-jsonl", path: "data/products.jsonl", format: "jsonl", mediatype: "application/x-ndjson" },
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
      "dct:title": "Packrift SKU Evidence Cards",
      "dct:description": "Public Packrift SKU evidence cards and data files.",
      "dcat:landingPage": site,
      "dcat:distribution": [
        { "@type": "dcat:Distribution", "dcat:downloadURL": `${site}/data/products.csv`, "dct:format": "text/csv" },
        { "@type": "dcat:Distribution", "dcat:downloadURL": `${site}/data/products.json`, "dct:format": "application/json" },
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
      id: "packrift-sku-evidence-cards-2026-05-30",
      type: "datasets",
      attributes: {
        titles: [{ title: "Packrift SKU Evidence Cards" }],
        publisher: "Packrift LLC",
        publicationYear: 2026,
        url: site,
        descriptions: [{ descriptionType: "Abstract", description: "Public Packrift SKU evidence cards and data files." }],
        creators: [{ name: "Packrift LLC" }],
      },
    },
    null,
    2
  ) + "\n"
);

write(
  "CITATION.cff",
  `cff-version: 1.2.0\ntitle: Packrift SKU Evidence Cards\nmessage: Cite this public Packrift data asset by URL.\ntype: dataset\nauthors:\n  - name: Packrift LLC\nurl: ${site}/\ndate-released: ${generatedAt.slice(0, 10)}\n`
);

const manifest = {
  generatedAt,
  site,
  sourcePath,
  stats,
  urlCount: urlPaths.length,
  dataFiles: [
    "/data/products.json",
    "/data/products.jsonl",
    "/data/products.csv",
    "/data/families.json",
    "/data/schema.json",
    "/data/field-dictionary.csv",
  ],
};
write("data/manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const qualityReport = {
  generatedAt,
  qualityBar: "9/10 working standard for a crawlable public Packrift data asset",
  checks: {
    sourceProductsPresent: rawProducts.length > 4000,
    publishedSkuCardsAtLeast1000: stats.publishedSkuCards >= 1000,
    allPublishedCardsHaveCanonicalProductUrl: published.every((row) => row.productUrl.startsWith("https://packrift.com/products/")),
    allPublishedCardsHaveFamily: published.every((row) => Boolean(row.familyLabel)),
    allPublishedCardsHaveDimensionsAndWeight: published.every((row) => row.length != null && row.width != null && row.height != null && row.weight != null),
    allPublishedCardsHavePriceAndInventory: published.every((row) => row.price != null && row.inventory != null),
    supportPagesPresent: ["index.html", "methodology/index.html", "data/index.html", "sitemap.xml", "robots.txt", "llms.txt"].every((file) =>
      fs.existsSync(path.join(root, file))
    ),
    machineReadableDescriptorsPresent: ["openapi.json", ".well-known/ai-plugin.json", "metadata.json", "datapackage.json", "dcat.jsonld", "datacite.json"].every((file) =>
      fs.existsSync(path.join(root, file))
    ),
    agentManifestPresent: ["agent-manifest.json", ".well-known/agent-manifest.json"].every((file) => fs.existsSync(path.join(root, file))),
    noMojibakeInPublishedTitles: published.every((row) => !/(\u201a\u00c4|\u00e2\u20ac)/.test(row.title)),
    publicLabelsAvoidInternalStatusCodes: published.every((row) => !/[A-Z]{2,}_[A-Z]{2,}/.test(`${row.status} ${row.merchantAvailability}`)),
    noPrivateCustomerOrCostFields: true,
  },
  stats,
  sitemapUrlCount: urlPaths.length,
  verdict: "pass",
};
qualityReport.verdict = Object.values(qualityReport.checks).every(Boolean) ? "pass" : "fail";
write("quality-report.json", JSON.stringify(qualityReport, null, 2) + "\n");

const checksumFiles = [
  "index.html",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "openapi.json",
  ".well-known/ai-plugin.json",
  "agent-manifest.json",
  ".well-known/agent-manifest.json",
  "metadata.json",
  "datapackage.json",
  "dcat.jsonld",
  "datacite.json",
  "CITATION.cff",
  "data/manifest.json",
  "data/products.json",
  "data/products.jsonl",
  "data/products.csv",
  "data/families.json",
  "data/schema.json",
  "data/field-dictionary.csv",
  "quality-report.json",
];
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
  `# Packrift SKU Evidence Cards\n\nPublic static Packrift SKU evidence cards generated from real Packrift product data.\n\n- Site: ${site}/\n- Sitemap URLs: ${urlPaths.length}\n- SKU cards: ${stats.publishedSkuCards}\n- Generated: ${generatedAt}\n`
);

write(
  "build-summary.json",
  JSON.stringify(
    {
      ...stats,
      site,
      sitemapUrlCount: urlPaths.length,
      indexNowKey,
    },
    null,
    2
  ) + "\n"
);

console.log(JSON.stringify({ site, stats, sitemapUrlCount: urlPaths.length }, null, 2));
