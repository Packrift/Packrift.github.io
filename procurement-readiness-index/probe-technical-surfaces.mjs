import fs from "node:fs";

const HOST = "packrift-procurement-readiness-index.vercel.app";
const USER_AGENT = "PackriftLedgerVerifier/2026-05-30";

const candidates = [
  { name: "RIPEstat resource page", url: `https://stat.ripe.net/resource/${HOST}` },
  { name: "OpenAdminTools host page", url: `https://www.openadmintools.com/en/${HOST}/` },
  { name: "AlienVault OTX indicator JSON", url: `https://otx.alienvault.com/api/v1/indicators/domain/${HOST}/general` },
  { name: "SecurityHeaders report", url: `https://securityheaders.com/?q=${HOST}&followRedirects=on` },
  { name: "SSL Labs analyzer", url: `https://www.ssllabs.com/ssltest/analyze.html?d=${HOST}` },
  { name: "Green Web Foundation check", url: `https://api.thegreenwebfoundation.org/api/v3/greencheck/${HOST}` },
  { name: "DNSViz DNSSEC page", url: `https://dnsviz.net/d/${HOST}/dnssec/` },
  { name: "Internet.nl stable site report", url: `https://internet.nl/site/${HOST}/results` },
  { name: "Check-Host info", url: `https://check-host.net/ip-info?host=${HOST}` },
  { name: "ViewDNS IP location", url: `https://viewdns.info/iplocator/?host=${HOST}` },
];

const headersObject = (headers) =>
  Object.fromEntries([...headers.entries()].sort(([a], [b]) => a.localeCompare(b)));

const count = (text, pattern) => (text.match(pattern) || []).length;

async function probe(candidate) {
  try {
    const response = await fetch(candidate.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/json,text/plain,*/*",
      },
    });
    const text = await response.text();
    const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
    const noindex =
      /noindex/i.test(response.headers.get("x-robots-tag") || "") ||
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(text);
    const challenge = /captcha|cloudflare challenge|authentication required|access denied|checking your browser/i.test(text);
    return {
      ...candidate,
      final_url: response.url,
      status: response.status,
      ok: response.ok,
      content_type: response.headers.get("content-type") || "",
      x_robots_tag: response.headers.get("x-robots-tag") || "",
      headers: headersObject(response.headers),
      title,
      bytes: Buffer.byteLength(text),
      packrift_mentions: count(text, /packrift/gi),
      host_mentions: count(text, new RegExp(HOST.replaceAll(".", "\\."), "gi")),
      noindex,
      challenge,
      sample: text.replace(/\s+/g, " ").slice(0, 700),
    };
  } catch (error) {
    return { ...candidate, status: 0, ok: false, error: String(error) };
  }
}

const results = [];
for (const candidate of candidates) results.push(await probe(candidate));

const promotable = results.filter((result) =>
  result.ok &&
  !result.noindex &&
  !result.challenge &&
  (result.host_mentions > 0 || result.packrift_mentions > 0)
);

const evidence = {
  checked_at: new Date().toISOString(),
  host: HOST,
  results,
  promotable: promotable.map((result) => ({
    name: result.name,
    url: result.url,
    final_url: result.final_url,
    status: result.status,
    title: result.title,
    packrift_mentions: result.packrift_mentions,
    host_mentions: result.host_mentions,
  })),
};

fs.writeFileSync("technical-profile-probes-2026-05-30.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({
  checked: results.length,
  promotable: evidence.promotable,
  held: results
    .filter((result) => !promotable.includes(result))
    .map((result) => ({ name: result.name, status: result.status, noindex: result.noindex, challenge: result.challenge, host_mentions: result.host_mentions || 0 })),
}, null, 2));
