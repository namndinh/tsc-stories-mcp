import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { load } from "cheerio";
import express, { Request, Response } from "express";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Story {
  title: string;
  slug: string;
  url: string;
  date: string;
}

interface StoryContent extends Story {
  body: string;
  summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.tsc.ai";
const STORIES_URL = `${BASE_URL}/customer-stories`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TSC-MCP-Server/1.0)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

async function fetchStoryList(): Promise<Story[]> {
  try {
    const html = await fetchHtml(STORIES_URL);
    const $ = load(html);
    const stories: Story[] = [];
    $("a[href^='/stories/']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const slug = href.replace("/stories/", "");
      if (stories.find((s) => s.slug === slug)) return;
      const title = $(el).find("h3, h2").text().trim();
      if (!title) return;
      const dateEl = $(el).closest("div").parent()
        .find("div, p, span")
        .filter((_, e) => /\w+ \d+, \d{4}/.test($(e).text()))
        .first();
      stories.push({ title, slug, url: `${BASE_URL}/stories/${slug}`, date: dateEl.text().trim() || "Unknown" });
    });
    return stories.length > 0 ? stories : FALLBACK_STORIES;
  } catch {
    return FALLBACK_STORIES;
  }
}

async function fetchStoryContent(slug: string): Promise<StoryContent> {
  const meta = FALLBACK_STORIES.find((s) => s.slug === slug);
  const url = `${BASE_URL}/stories/${slug}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  $("nav, header, footer, script, style, noscript").remove();
  let body = "";
  for (const sel of ["article", "[class*='rich-text']", "[class*='content']", "main"]) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      body = el.find("p, h1, h2, h3, h4, li").map((_, e) => $(e).text().trim()).get().filter(Boolean).join("\n\n");
      break;
    }
  }
  if (!body) body = $("p").map((_, e) => $(e).text().trim()).get().filter((t) => t.length > 40).join("\n\n");
  return { title: meta?.title || $("h1").first().text().trim() || slug, slug, url, date: meta?.date || "Unknown", body, summary: body.split("\n\n")[0] || "" };
}

// ─── Fallback snapshot ────────────────────────────────────────────────────────

const FALLBACK_STORIES: Story[] = [
  { title: "How a Leading Agri Company Transformed Government Affairs to a Quantifiable Value Driver", slug: "how-a-leading-agri-company-transformed-government-affairs-to-a-quantifiable-value-driver", url: `${BASE_URL}/stories/how-a-leading-agri-company-transformed-government-affairs-to-a-quantifiable-value-driver`, date: "September 19, 2025" },
  { title: "How a National Utility Company Builds Corporate Memory to Navigate Regulatory Changes", slug: "how-a-national-utility-company-builds-corporate-memory-to-navigate-regulatory-changes", url: `${BASE_URL}/stories/how-a-national-utility-company-builds-corporate-memory-to-navigate-regulatory-changes`, date: "August 25, 2025" },
  { title: "How a Leading Energy Operator Manages Contractor Risk", slug: "how-a-leading-energy-operator-manages-contractor-risk", url: `${BASE_URL}/stories/how-a-leading-energy-operator-manages-contractor-risk`, date: "August 14, 2025" },
  { title: "How an Oil & Gas's BD Team Leveraged TSC.ai to Institutionalise BD Intelligence", slug: "how-an-oil-gass-bd-team-leveraged-tsc-ai-to-institutionalise-bd-intelligence", url: `${BASE_URL}/stories/how-an-oil-gass-bd-team-leveraged-tsc-ai-to-institutionalise-bd-intelligence`, date: "July 30, 2025" },
  { title: "How A Major Mining Company Uses TSC.ai to Navigate Regulatory Risks in Mining Closure", slug: "how-a-major-mining-company-uses-tsc-ai-to-navigate-mine-closure-regulations", url: `${BASE_URL}/stories/how-a-major-mining-company-uses-tsc-ai-to-navigate-mine-closure-regulations`, date: "June 11, 2025" },
  { title: "How an Oil & Gas' Public Affairs Team Uses TSC.ai Solution to Navigate the Plastic Landscape", slug: "how-an-oil-gass-public-affairs-team-uses-tsc-ai-solution-to-navigate-the-plastic-landscape", url: `${BASE_URL}/stories/how-an-oil-gass-public-affairs-team-uses-tsc-ai-solution-to-navigate-the-plastic-landscape`, date: "February 13, 2025" },
  { title: "A global financial giant's strategy to revolutionize its security management", slug: "a-global-financial-giants-strategy-to-revolutionize-its-security-management", url: `${BASE_URL}/stories/a-global-financial-giants-strategy-to-revolutionize-its-security-management`, date: "November 28, 2024" },
  { title: "How A Global Lighting Company Scaled Lead Generation", slug: "how-a-global-lighting-company-scaled-lead-generation", url: `${BASE_URL}/stories/how-a-global-lighting-company-scaled-lead-generation`, date: "December 1, 2023" },
  { title: "#Tech4Good: Empowering Change with AI", slug: "https-www-tsc-ai-stories-techforgood-nonprofit-with-ai", url: `${BASE_URL}/stories/https-www-tsc-ai-stories-techforgood-nonprofit-with-ai`, date: "August 15, 2023" },
  { title: "Navigating the EU wind energy battlefield", slug: "navigating-the-eu-wind-energy-battlefield", url: `${BASE_URL}/stories/navigating-the-eu-wind-energy-battlefield`, date: "May 25, 2023" },
  { title: "Coordinating a global sugar tax strategy", slug: "coordinating-a-global-sugar-tax-strategy", url: `${BASE_URL}/stories/coordinating-a-global-sugar-tax-strategy`, date: "May 25, 2023" },
  { title: "Learning from the VW scandal", slug: "learning-from-the-vw-scandal", url: `${BASE_URL}/stories/learning-from-the-vw-scandal`, date: "May 25, 2023" },
  { title: "Frontier market entry - Avoid going to jail", slug: "frontier-market-entry-avoid-going-to-jail", url: `${BASE_URL}/stories/frontier-market-entry-avoid-going-to-jail`, date: "May 25, 2023" },
  { title: "Mexico – ground zero for plastic bans", slug: "mexico-ground-zero-for-plastic-bans", url: `${BASE_URL}/stories/mexico-ground-zero-for-plastic-bans`, date: "May 25, 2023" },
  { title: "Minimise delays and cost increases from security attacks on assets", slug: "minimise-delays-and-cost-increases-from-security-attacks-on-assets", url: `${BASE_URL}/stories/minimise-delays-and-cost-increases-from-security-attacks-on-assets`, date: "May 24, 2023" },
  { title: "Digital Activism: Targeting Big Oil via Big Tech", slug: "digital-activism-targeting-big-oil-via-big-tech", url: `${BASE_URL}/stories/digital-activism-targeting-big-oil-via-big-tech`, date: "May 24, 2023" },
  { title: "Decoding the Alternative Mining Indaba in South Africa", slug: "decoding-the-alternative-mining-indaba-in-south-africa", url: `${BASE_URL}/stories/decoding-the-alternative-mining-indaba-in-south-africa`, date: "April 20, 2023" },
  { title: "Combatting rhino poaching", slug: "combatting-rhino-poaching", url: `${BASE_URL}/stories/combatting-rhino-poaching`, date: "April 20, 2023" },
];

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({ name: "tsc-customer-stories", version: "1.0.0" });

server.tool("list_stories", "List all TSC customer stories. Optionally filter by a keyword in the title.",
  { keyword: z.string().optional().describe("Optional keyword to filter by title") },
  async ({ keyword }) => {
    const stories = await fetchStoryList();
    const filtered = keyword ? stories.filter((s) => s.title.toLowerCase().includes(keyword.toLowerCase())) : stories;
    const text = filtered.length
      ? `Found ${filtered.length} stories:\n\n` + filtered.map((s, i) => `${i + 1}. **${s.title}**\n   Date: ${s.date}\n   Slug: ${s.slug}\n   URL: ${s.url}`).join("\n\n")
      : `No stories found matching "${keyword}".`;
    return { content: [{ type: "text", text }] };
  }
);

server.tool("get_story", "Fetch the full content of a TSC customer story by its slug.",
  { slug: z.string().describe("Story slug, e.g. 'learning-from-the-vw-scandal'") },
  async ({ slug }) => {
    const story = await fetchStoryContent(slug);
    return { content: [{ type: "text", text: [`# ${story.title}`, `**Date:** ${story.date}  |  **URL:** ${story.url}`, ``, `## Summary`, story.summary, ``, `## Full Content`, story.body || "(Could not extract — visit URL directly.)"].join("\n") }] };
  }
);

server.tool("search_stories", "Search TSC customer stories by industry sector or topic (e.g. 'mining', 'utility', 'security', 'oil').",
  { query: z.string().describe("Topic or sector to search for") },
  async ({ query }) => {
    const stories = await fetchStoryList();
    const q = query.toLowerCase();
    const scored = stories
      .map((s) => ({ story: s, score: q.split(/\s+/).filter((w) => s.title.toLowerCase().includes(w)).length }))
      .filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    const text = scored.length
      ? `Found ${scored.length} stories for "${query}":\n\n` + scored.map((r, i) => `${i + 1}. **${r.story.title}** (${r.story.date})\n   Slug: ${r.story.slug}`).join("\n\n")
      : `No stories matched "${query}". Try: mining, oil, utility, energy, security, agriculture, plastic.`;
    return { content: [{ type: "text", text }] };
  }
);

// ─── HTTP Server ──────────────────────────────────────────────────────────────

async function main() {
  const app = express();
  app.use(express.json());

  app.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', name: 'tsc-stories-mcp', version: '1.0.0' });
  });

  // MCP endpoint — every client (Claude, Cursor, etc.) POST here
  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — fine for single-user demos
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`TSC Customer Stories MCP server running on http://localhost:${port}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});