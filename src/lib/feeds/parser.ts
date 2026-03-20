/**
 * RSS/Atom Feed Parser
 *
 * Wraps `rss-parser` with a 15-second timeout, HTML stripping,
 * and date normalization. Returns a flat array of ParsedFeedItem
 * regardless of feed format (RSS 2.0, Atom, Google News RSS).
 */

import Parser from "rss-parser";

export interface ParsedFeedItem {
  title: string;
  url: string;
  summary: string;
  author: string;
  publishedAt: Date;
  rawContent?: string;
}

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "Protoprism/1.0 (feed-ingest)" },
  customFields: {
    item: [
      ["dc:creator", "dcCreator"],
      ["author", "authorField"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

/**
 * Strip HTML tags from a string, collapsing whitespace.
 * Intentionally simple — we only need readable summaries, not rendered HTML.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Attempt to parse a date string into a Date object.
 * Falls back to current timestamp if parsing fails.
 */
function safeParseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return new Date();
  return parsed;
}

/**
 * Resolve the author field from various feed formats.
 * RSS uses <author> or <dc:creator>, Atom uses <author><name>.
 */
function resolveAuthor(item: Record<string, unknown>): string {
  const creator = item.dcCreator ?? item.authorField ?? item.creator ?? item.author;
  if (typeof creator === "string") return creator;
  if (creator && typeof creator === "object" && "name" in (creator as Record<string, unknown>)) {
    return String((creator as Record<string, unknown>).name);
  }
  return "";
}

/**
 * Parse an RSS/Atom feed URL and return normalized items.
 *
 * On any error (network, parse, timeout), logs a warning and
 * returns an empty array — callers should never throw on feed failure.
 */
export async function parseFeed(feedUrl: string): Promise<ParsedFeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const items: ParsedFeedItem[] = [];

    for (const entry of feed.items ?? []) {
      const title = (entry.title ?? "").trim();
      const url = (entry.link ?? "").trim();

      // Skip entries without a title or URL — they're not useful
      if (!title || !url) continue;

      const rawContent = entry.contentEncoded as string | undefined
        ?? entry["content:encoded"] as string | undefined
        ?? entry.content as string | undefined
        ?? "";

      const summarySource = entry.contentSnippet
        ?? entry.summary
        ?? rawContent
        ?? "";

      const summary = stripHtml(typeof summarySource === "string" ? summarySource : String(summarySource))
        .slice(0, 1000);

      items.push({
        title,
        url,
        summary,
        author: resolveAuthor(entry as unknown as Record<string, unknown>),
        publishedAt: safeParseDate(entry.pubDate ?? entry.isoDate),
        rawContent: rawContent ? stripHtml(rawContent).slice(0, 5000) : undefined,
      });
    }

    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[feeds/parser] Failed to parse feed ${feedUrl}: ${message}`);
    return [];
  }
}
