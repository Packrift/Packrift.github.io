import fs from "node:fs";

const HOST = "packrift-procurement-readiness-index.vercel.app";
const USER_AGENT = "PackriftLedgerVerifier/2026-05-30";

const candidates = [
  {
    id: "ipqualityscore",
    name: "IPQualityScore domain reputation",
    tier: "B",
    url: `https://www.ipqualityscore.com/domain-reputation/${HOST}`,
  },
  {
    id: "w3techs",
    name: "W3Techs site info",
    tier: "C",
    url: `https://w3techs.com/sites/info/${HOST}`,
    allowWeakIndexedShell: true,
  },
  {
    id: "viewdns-dnsrecord",
    name: "ViewDNS DNS record",
    tier: "B",
    url: `https://viewdns.info/dnsrecord/?domain=${HOST}`,
  },
  {
    id: "dnswatch-a",
    name: "DNSWatch A record",
    tier: "B",
    url: `https://www.dnswatch.info/dns/dnslookup?la=en&host=${HOST}&type=A&submit=Resolve`,
  },
  {
    id: "he-bgp-dns",
    name: "Hurricane Electric BGP DNS",
    tier: "B",
    url: `https://bgp.he.net/dns/${HOST}`,
  },
  {
    id: "verisign-dnssec-debugger",
    name: "Verisign DNSSEC debugger",
    tier: "B",
    url: `https://dnssec-debugger.verisignlabs.com/${HOST}`,
  },
  {
    id: "mywot-scorecard",
    name: "MyWOT scorecard",
    tier: "C",
    url: `https://www.mywot.com/scorecard/${HOST}`,
  },
  {
    id: "robtex-dns-lookup",
    name: "Robtex DNS lookup",
    tier: "B",
    url: `https://www.robtex.com/dns-lookup/${HOST}`,
  },
  {
    id: "securityheaders-retry",
    name: "SecurityHeaders retry",
    tier: "B",
    url: `https://securityheaders.com/?q=${HOST}&followRedirects=on`,
  },
  {
    id: "statshow",
    name: "StatShow profile",
    tier: "C",
    url: `https://www.statshow.com/www/${HOST}`,
  },
  {
    id: "urlscan",
    name: "urlscan.io domain page",
    tier: "B",
    url: `https://urlscan.io/domain/${HOST}`,
  },
  {
    id: "crtsh",
    name: "crt.sh certificate search",
    tier: "C",
    url: `https://crt.sh/?q=${HOST}`,
  },
];

const headersObject = (headers) =>
  Object.fromEntries([...headers.entries()].sort(([a], [b]) => a.localeCompare(b)));

const count = (text, pattern) => (text.match(pattern) || []).length;

const compact = (text) => text.replace(/\s+/g, " ").trim();

function classify(candidate, result) {
  const noResult = result.no_result_marker;
  const hostEvidence = result.host_mentions > 0;
  const packriftEvidence = result.packrift_mentions > 0;
  const okStatus = result.status >= 200 && result.status < 300;

  if (!okStatus) return { status: "held", reason: `http-${result.status || 0}` };
  if (result.noindex) return { status: "held", reason: "noindex" };
  if (result.challenge) return { status: "held", reason: "challenge-or-auth-wall" };
  if (!hostEvidence && !packriftEvidence) return { status: "held", reason: "no-packrift-or-host-evidence" };
  if (noResult && !candidate.allowWeakIndexedShell) return { status: "held", reason: "no-result-marker" };

  return {
    status: "promote",
    reason: candidate.allowWeakIndexedShell && noResult ? "weak-host-profile-with-host-evidence" : "public-host-profile",
  };
}

async function probe(candidate) {
  try {
    const response = await fetch(candidate.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/json,text/plain,*/*",
      },
    });
    const text = await response.text();
    const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
    const xRobots = response.headers.get("x-robots-tag") || "";
    const resultText = `${title} ${text}`;
    const noindex =
      /noindex/i.test(xRobots) ||
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(text);
    const challenge =
      /cloudflare challenge|authentication required|access denied|checking your browser|cf-mitigated|just a moment/i.test(
        resultText
      );
    const noResultMarker =
      /not observed|no results|nothing found|certificates none found|currently we have no information|no global rank|domain has not yet been|urlscan\.io - error|<h1[^>]*>server error/i.test(
        resultText
      );
    const result = {
      ...candidate,
      final_url: response.url,
      status: response.status,
      ok: response.ok,
      content_type: response.headers.get("content-type") || "",
      x_robots_tag: xRobots,
      headers: headersObject(response.headers),
      title,
      bytes: Buffer.byteLength(text),
      packrift_mentions: count(text, /packrift/gi),
      host_mentions: count(text, new RegExp(HOST.replaceAll(".", "\\."), "gi")),
      noindex,
      challenge,
      no_result_marker: noResultMarker,
      sample: compact(text).slice(0, 900),
    };
    return { ...result, classification: classify(candidate, result) };
  } catch (error) {
    return {
      ...candidate,
      status: 0,
      ok: false,
      error: String(error),
      classification: { status: "held", reason: "fetch-error" },
    };
  }
}

const results = [];
for (const candidate of candidates) results.push(await probe(candidate));

const promoted = results.filter((result) => result.classification.status === "promote");
const held = results.filter((result) => result.classification.status !== "promote");
const evidence = {
  checked_at: new Date().toISOString(),
  host: HOST,
  policy:
    "Count only public direct HTTP 2xx pages with Packrift/exact-host evidence and no noindex/challenge/no-result marker, except W3Techs weak host-info shell follows prior Tier C treatment.",
  results,
  promoted: promoted.map((result) => ({
    id: result.id,
    name: result.name,
    tier: result.tier,
    url: result.url,
    final_url: result.final_url,
    status: result.status,
    title: result.title,
    reason: result.classification.reason,
    packrift_mentions: result.packrift_mentions,
    host_mentions: result.host_mentions,
  })),
  held: held.map((result) => ({
    id: result.id,
    name: result.name,
    tier: result.tier,
    url: result.url,
    final_url: result.final_url || "",
    status: result.status,
    title: result.title || "",
    reason: result.classification.reason,
    noindex: Boolean(result.noindex),
    challenge: Boolean(result.challenge),
    no_result_marker: Boolean(result.no_result_marker),
    packrift_mentions: result.packrift_mentions || 0,
    host_mentions: result.host_mentions || 0,
  })),
  movement_if_promoted: {
    backlink_citation_surfaces_excluding_indexing: promoted.length,
    verified_live_existing: promoted.length,
    submitted_pending: 0,
    owned_public_url_mentions: 0,
    indexing_discovery_only: 0,
    tier_ab_non_github_quality: promoted.filter((result) => ["A", "B"].includes(result.tier)).length,
    useful_semrush_visible_referring_domains: 0,
    total_semrush_visible_referring_domains: 0,
    bing_visible_linking_pages_domains: 0,
  },
};

fs.writeFileSync(
  "additional-technical-profile-probes-2026-05-30.json",
  JSON.stringify(evidence, null, 2) + "\n"
);

console.log(
  JSON.stringify(
    {
      checked: results.length,
      promoted: evidence.promoted,
      held: evidence.held,
      movement_if_promoted: evidence.movement_if_promoted,
    },
    null,
    2
  )
);
