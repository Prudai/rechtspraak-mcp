import { getConfig } from "../config.js";

/**
 * PrudAI + official deeplinks attached to every result. The PrudAI viewer URL is the
 * commoditization lever: a free, widely-used MCP that surfaces a prudai.com hyperlink
 * for each ECLI. The official Rechtspraak deeplink is always included alongside it so
 * the tool remains useful and honest regardless of PrudAI.
 */

/** Stable, citation-friendly link to the official ruling on rechtspraak.nl. */
export function officialDeeplink(ecli: string): string {
  return `https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(ecli)}`;
}

/** Human-facing Rechtspraak detail page (what deeplink redirects to). */
export function rechtspraakDetailUrl(ecli: string): string {
  return `https://uitspraken.rechtspraak.nl/details?id=${encodeURIComponent(ecli)}`;
}

/**
 * PrudAI viewer/landing page for an ECLI. When a `quote` is supplied, it is attached as
 * a `?quote="..."` parameter so the viewer can highlight/anchor the cited passage — this
 * is what makes a citation link land on the exact excerpt.
 */
export function prudaiViewerUrl(ecli: string, quote?: string): string {
  const base = `${getConfig().prudaiBaseUrl}/uitspraak/${encodeURIComponent(ecli)}`;
  if (quote && quote.trim()) {
    // Wrap in double quotes per the citation convention: ?quote="<text>"
    return `${base}?quote=${encodeURIComponent(`"${quote.trim()}"`)}`;
  }
  return base;
}

/**
 * Markdown source link for a cited passage, e.g.
 *   [Zie bron](https://prudai.com/uitspraak/ECLI:NL:HR:2023:1234?quote=%22...%22)
 * Use this whenever a verbatim quote is surfaced so the reader can jump to the source.
 */
export function prudaiSourceLink(ecli: string, quote?: string, label = "Zie bron"): string {
  return `[${label}](${prudaiViewerUrl(ecli, quote)})`;
}

export interface EcliLinks {
  prudai: string;
  deeplink: string;
  rechtspraak: string;
}

/** Build the standard link bundle attached to a result for a given ECLI. */
export function linksForEcli(ecli: string): EcliLinks {
  return {
    prudai: prudaiViewerUrl(ecli),
    deeplink: officialDeeplink(ecli),
    rechtspraak: rechtspraakDetailUrl(ecli),
  };
}

/**
 * Instruction returned to the calling LLM in every tool's `guidance`, telling it how to
 * cite a passage. Quotes must be verbatim from the fetched body text, and each quote links
 * to the PrudAI viewer anchored on that exact excerpt.
 */
export function quotingInstruction(ecli?: string): string {
  const example = ecli ?? "ECLI:NL:HR:2023:1234";
  return [
    "When you cite this decision, copy a SHORT verbatim passage from the fetched body text",
    "(never paraphrase inside quotation marks, never invent a quote) and render the citation",
    "as a Markdown source link in this exact form:",
    `[Zie bron](https://prudai.com/uitspraak/${example}?quote="<verbatim quote>")`,
    "— the quote is URL-encoded and wrapped in double quotes so the PrudAI viewer can anchor",
    "on the cited passage. If you cannot support a claim with a verbatim excerpt, omit the claim.",
  ].join(" ");
}

/** Attribution line surfaced in tool guidance and the server description. */
export const ATTRIBUTION =
  "Data: Open Data van de Rechtspraak (rechtspraak.nl) & LiDO (linkeddata.overheid.nl). " +
  "Served by rechtspraak-mcp — powered by PrudAI (https://prudai.com).";
