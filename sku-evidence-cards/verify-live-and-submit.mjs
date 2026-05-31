import fs from "node:fs";

const HOST = "packrift-sku-evidence-cards.vercel.app";
const SITE = `https://${HOST}`;
const INDEXNOW_KEY = "7d4ea0e32d6f4924b35d7b8c4e3a95f1";
const USER_AGENT = "PackriftLedgerVerifier/2026-05-30";

const headersObject = (headers) =>
  Object.fromEntries([...headers.entries()].sort(([a], [b]) => a.localeCompare(b)));

const count = (text, pattern) => (text.match(pattern) || []).length;

async function probe(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,text/plain,*/*" },
    ...options,
  });
  const text = await response.text();
  const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  const noindex =
    /noindex/i.test(response.headers.get("x-robots-tag") || "") ||
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(text);
  const challenge = /captcha|cloudflare challenge|authentication required|login required|access denied|deployment protection/i.test(text);
  return {
    url,
    final_url: response.url,
    status: response.status,
    ok: response.ok,
    content_type: response.headers.get("content-type") || "",
    x_robots_tag: response.headers.get("x-robots-tag") || "",
    headers: headersObject(response.headers),
    title,
    bytes: Buffer.byteLength(text),
    duration_ms: Date.now() - started,
    packrift_mentions: count(text, /packrift/gi),
    packrift_dot_com_mentions: count(text, /packrift\.com/gi),
    target_host_mentions: count(text, new RegExp(HOST.replaceAll(".", "\\."), "gi")),
    noindex,
    challenge,
    sample: text.replace(/\s+/g, " ").slice(0, 700),
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json,text/plain,*/*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headersObject(response.headers),
    text,
    json,
  };
}

const sitemapXml = fs.readFileSync("sitemap.xml", "utf8");
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const liveUrls = [
  `${SITE}/`,
  `${SITE}/robots.txt`,
  `${SITE}/sitemap.xml`,
  `${SITE}/llms.txt`,
  `${SITE}/${INDEXNOW_KEY}.txt`,
  `${SITE}/metadata.json`,
  `${SITE}/datapackage.json`,
  `${SITE}/dcat.jsonld`,
  `${SITE}/datacite.json`,
  `${SITE}/CITATION.cff`,
  `${SITE}/openapi.json`,
  `${SITE}/.well-known/openapi.json`,
  `${SITE}/.well-known/ai-plugin.json`,
  `${SITE}/data/`,
  `${SITE}/data/products.json`,
  `${SITE}/data/products.jsonl`,
  `${SITE}/data/products.csv`,
  `${SITE}/families/boxes/`,
  `${SITE}/price-bands/under-25/`,
  `${SITE}/sku/1066-10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle/`,
];

const live_checks = [];
for (const url of liveUrls) {
  live_checks.push(await probe(url));
}

const indexnowPayload = {
  host: HOST,
  key: INDEXNOW_KEY,
  keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
  urlList: sitemapUrls,
};

const indexnow = {
  generic: await postJson("https://api.indexnow.org/IndexNow", indexnowPayload),
  bing: await postJson("https://www.bing.com/indexnow", indexnowPayload),
};

const notHumanSubmit = await postJson("https://nothumansearch.ai/api/v1/submit", { url: SITE });
const notHumanChecks = [
  await probe(`https://nothumansearch.ai/api/v1/site/${HOST}`),
  await probe(`https://nothumansearch.ai/site/${HOST}`),
];

const evidence = {
  checked_at: new Date().toISOString(),
  site: SITE,
  deployment_alias: SITE,
  sitemap_url_count: sitemapUrls.length,
  live_checks,
  indexnow,
  not_human_search: {
    submit: notHumanSubmit,
    checks: notHumanChecks,
  },
  count_treatment: {
    owned_public_url_mentions: sitemapUrls.length,
    indexnow_discovery_receipts: Number(indexnow.generic.ok) * sitemapUrls.length + Number(indexnow.bing.ok) * sitemapUrls.length,
    not_human_verified_surface:
      notHumanChecks.some((result) => result.ok && !result.noindex && !result.challenge && result.target_host_mentions > 0),
  },
};

fs.writeFileSync("live-verify-submit-2026-05-30.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({
  sitemap_url_count: evidence.sitemap_url_count,
  live_ok: live_checks.filter((result) => result.ok && !result.noindex && !result.challenge).length,
  live_total: live_checks.length,
  indexnow_generic_status: indexnow.generic.status,
  indexnow_bing_status: indexnow.bing.status,
  nothuman_submit_status: notHumanSubmit.status,
  nothuman_check_statuses: notHumanChecks.map((result) => result.status),
  count_treatment: evidence.count_treatment,
}, null, 2));
