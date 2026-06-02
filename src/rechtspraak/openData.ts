import { httpRequest, HttpStatusError } from "../lib/http.js";
import { parseXml, asArray, asText } from "../lib/xml.js";
import { linksForEcli } from "../lib/prudai.js";
import { RechtspraakNotFoundError, RechtspraakNotPublishedError } from "./errors.js";
import type { RelatedRef, SearchResponse, UitspraakDocument, UitspraakSummary, WaardelijstEntry } from "./types.js";

const ZOEKEN_URL = "https://data.rechtspraak.nl/uitspraken/zoeken";
const CONTENT_URL = "https://data.rechtspraak.nl/uitspraken/content";
const PSI_RECHTSGEBIED_PREFIX = "http://psi.rechtspraak.nl/rechtsgebied#";

/** Map common rechtsgebied slugs to their canonical PSI URI. Full URIs pass through. */
const RECHTSGEBIED_SLUGS: Record<string, string> = {
  bestuursrecht: `${PSI_RECHTSGEBIED_PREFIX}bestuursrecht`,
  civielrecht: `${PSI_RECHTSGEBIED_PREFIX}civielRecht`,
  strafrecht: `${PSI_RECHTSGEBIED_PREFIX}strafrecht`,
  internationaalpubliekrecht: `${PSI_RECHTSGEBIED_PREFIX}internationaalPubliekrecht`,
};

export function resolveRechtsgebied(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return RECHTSGEBIED_SLUGS[trimmed.toLowerCase().replace(/\s+/g, "")] ?? trimmed;
}

export interface OpenDataSearchOptions {
  max?: number;
  from?: number;
  sort?: "ASC" | "DESC";
  type?: "Uitspraak" | "Conclusie";
  dateFrom?: string;
  dateTo?: string;
  modifiedFrom?: string;
  modifiedTo?: string;
  /** Rechtsgebied slug or full PSI URI (Atom `subject` param). */
  rechtsgebied?: string;
  /** Instantie OWMS URI (Atom `creator` param). Use list_waardelijsten to find these. */
  creator?: string;
  /** Only return ECLIs that have a full document body. */
  documentsOnly?: boolean;
}

const WAARDELIJSTEN: Record<string, string> = {
  instanties: "https://data.rechtspraak.nl/Waardelijst/Instanties",
  instanties_buitenlands: "https://data.rechtspraak.nl/Waardelijst/InstantiesBuitenlands",
  rechtsgebieden: "https://data.rechtspraak.nl/Waardelijst/Rechtsgebieden",
  proceduresoorten: "https://data.rechtspraak.nl/Waardelijst/Proceduresoorten",
  niet_nederlandse_uitspraken: "https://data.rechtspraak.nl/Waardelijst/NietNederlandseUitspraken",
};

export type WaardelijstName = keyof typeof WAARDELIJSTEN;

export const WAARDELIJST_NAMES = Object.keys(WAARDELIJSTEN) as WaardelijstName[];

/** Faceted search against the official Open Data Atom feed. No free-text query. */
export async function searchOpenData(options: OpenDataSearchOptions): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set("max", String(Math.max(1, Math.min(1000, options.max ?? 25))));
  if (options.from !== undefined) params.set("from", String(Math.max(0, options.from)));
  if (options.sort) params.set("sort", options.sort);
  if (options.type) params.set("type", options.type);
  // `date` accepts two values to form a [from, to] range.
  if (options.dateFrom) params.append("date", options.dateFrom);
  if (options.dateTo) params.append("date", options.dateTo);
  if (options.modifiedFrom) params.append("modified", options.modifiedFrom);
  if (options.modifiedTo) params.append("modified", options.modifiedTo);
  if (options.rechtsgebied) params.set("subject", resolveRechtsgebied(options.rechtsgebied));
  if (options.creator) params.set("creator", options.creator);
  if (options.documentsOnly) params.set("return", "DOC");

  const { text } = await httpRequest(`${ZOEKEN_URL}?${params.toString()}`, {
    headers: { Accept: "application/atom+xml" },
  });

  const parsed = parseXml<{ feed?: { subtitle?: unknown; entry?: unknown } }>(text);
  const feed = parsed.feed ?? {};
  const subtitle = asText(feed.subtitle) ?? "";
  const countMatch = /(\d[\d.]*)/.exec(subtitle.replace(/\./g, ""));
  const totalCount = countMatch ? Number.parseInt(countMatch[1]!, 10) : 0;

  const results: UitspraakSummary[] = asArray(feed.entry).map((entry) => {
    const e = entry as Record<string, unknown>;
    const ecli = asText(e.id) ?? "";
    const summary = asText(e.summary);
    return {
      ecli,
      ...(asText(e.title) ? { title: asText(e.title) } : {}),
      ...(summary && summary !== "-" ? { summary } : {}),
      ...(asText(e.updated) ? { updated: asText(e.updated) } : {}),
      links: linksForEcli(ecli),
    };
  });

  return { totalCount, source: "open-data", results };
}

function readAttr(node: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = node[`@_${name}`];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Collect dcterms/psi metadata fields from the RDF descriptions into a flat record. */
function extractMetadata(rdf: unknown): { metadata: Record<string, string>; relations: RelatedRef[] } {
  const metadata: Record<string, string> = {};
  const relations: RelatedRef[] = [];
  const descriptions = asArray((rdf as Record<string, unknown> | undefined)?.["rdf:Description"]);

  for (const desc of descriptions) {
    const record = desc as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith("@_")) continue;
      const local = key.includes(":") ? key.split(":").pop()! : key;

      if (key.endsWith(":relation") || local === "relation") {
        for (const rel of asArray(value)) {
          const relNode = rel as Record<string, unknown>;
          const ecli = readAttr(relNode, "ecli:resourceIdentifier", "resourceIdentifier");
          const label = asText(rel);
          const ref: RelatedRef = {};
          if (ecli) ref.ecli = ecli;
          const type = readAttr(relNode, "psi:type", "type") ?? (label ? label.split(":")[0]?.trim() : undefined);
          if (type) ref.type = type;
          if (label) ref.label = label;
          if (ref.ecli || ref.label) relations.push(ref);
        }
        continue;
      }

      const text = asArray(value).map(asText).filter(Boolean)[0];
      if (text && !(local in metadata)) {
        metadata[local] = text;
      }
    }
  }
  return { metadata, relations };
}

/** Strip the `<uitspraak>`/`<conclusie>` body to plain text directly from the raw XML. */
function extractBodyText(raw: string): string | undefined {
  const match = /<(uitspraak|conclusie)\b[\s\S]*?<\/\1>/i.exec(raw);
  if (!match) return undefined;
  const text = match[0]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || undefined;
}

/** Fetch and normalize a single document from the Open Data content endpoint. */
export async function getContentOpenData(
  ecli: string,
  opts: { metadataOnly?: boolean } = {},
): Promise<UitspraakDocument> {
  const params = new URLSearchParams({ id: ecli });
  if (opts.metadataOnly) params.set("return", "META");

  let raw: string;
  try {
    raw = (await httpRequest(`${CONTENT_URL}?${params.toString()}`, {
      headers: { Accept: "application/xml" },
    })).text;
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 404) {
      throw new RechtspraakNotFoundError(ecli);
    }
    throw err;
  }

  const parsed = parseXml<{ "open-rechtspraak"?: { "rdf:RDF"?: unknown } }>(raw);
  const root = parsed["open-rechtspraak"] ?? {};
  const { metadata, relations } = extractMetadata(root["rdf:RDF"]);
  const bodyText = opts.metadataOnly ? undefined : extractBodyText(raw);

  if (!opts.metadataOnly && !bodyText) {
    throw new RechtspraakNotPublishedError(ecli);
  }

  return {
    ecli,
    source: "open-data",
    metadata,
    ...(bodyText ? { bodyText } : {}),
    relations,
    links: linksForEcli(ecli),
  };
}

/** Fetch one of the Rechtspraak value lists (waardelijsten). */
export async function getWaardelijst(name: WaardelijstName): Promise<WaardelijstEntry[]> {
  const url = WAARDELIJSTEN[name];
  if (!url) {
    throw new Error(`Unknown waardelijst "${name}". Valid names: ${WAARDELIJST_NAMES.join(", ")}.`);
  }
  const { text } = await httpRequest(url, { headers: { Accept: "application/xml" } });
  const parsed = parseXml<Record<string, unknown>>(text);

  // The list root varies per endpoint; collect every element that has an <Identifier>.
  const entries: WaardelijstEntry[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const identifier = asText(record.Identifier);
    const naam = asText(record.Naam);
    if (identifier || naam) {
      entries.push({
        ...(identifier ? { identifier } : {}),
        ...(naam ? { naam } : {}),
        ...(asText(record.Afkorting) ? { afkorting: asText(record.Afkorting) } : {}),
        ...(asText(record.Type) ? { type: asText(record.Type) } : {}),
      });
    }
    for (const value of Object.values(record)) visit(value);
  };
  visit(parsed);
  return entries;
}
