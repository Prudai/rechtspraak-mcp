import { httpRequest } from "../lib/http.js";
import { parseXml, asArray, asText } from "../lib/xml.js";

/**
 * Client for KOOP's live LiDO REST service (`get-links`). Returns the citation subgraph
 * around a single ECLI: cited/citing rulings, referenced statute articles, and official
 * publications, with typed edges.
 */
export const LIDO_DEFAULT_ENDPOINT = "https://linkeddata.overheid.nl/service";
export const LIDO_JURISPRUDENTIE_IRI_PREFIX = "http://linkeddata.overheid.nl/terms/jurisprudentie/id/";
export const LIDO_LINKTYPE_IRI_PREFIX = "http://linkeddata.overheid.nl/terms/linktype/id/";
const LIDO_BWB_IRI_FRAGMENT = "/terms/bwb/id/";
const LIDO_OEP_IRI_FRAGMENT = "/terms/oep/id/";

export type LidoNodeKind = "jurisprudentie" | "artikel" | "offpub" | "other";
export type LidoLinkDirection = "both" | "in" | "out";
export type LidoLinkCategory =
  | "reference"
  | "annulment"
  | "affirmation"
  | "conclusion"
  | "annotation"
  | "procedure"
  | "other";

export interface LidoNode {
  id: string;
  iri: string;
  kind: LidoNodeKind;
  label: string;
  court?: string;
  date?: string;
  rechtsgebied?: string;
  bwbLabel?: string;
  color?: string;
  deeplink?: string;
}

export interface LidoEdge {
  from: string;
  to: string;
  linkTypeIri: string;
  linkTypeCode: string;
  linkTypeLabel: string;
  linkCategory: LidoLinkCategory;
}

export interface LidoSubgraphStats {
  inboundCount: number;
  outboundCount: number;
  topRechtsgebieden: Array<{ label: string; count: number }>;
  topLinkTypes: Array<{ code: string; label: string; count: number }>;
  neighbourDateRange?: { earliest: string; latest: string };
}

export interface LidoSubgraph {
  center: LidoNode;
  nodes: LidoNode[];
  edges: LidoEdge[];
  stats: LidoSubgraphStats;
  truncation: { incoming: boolean; outgoing: boolean };
  endpoint: string;
}

export class LidoParseError extends Error {
  public readonly code = "LIDO_PARSE_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "LidoParseError";
  }
}

export class LidoQueryError extends Error {
  public readonly code = "LIDO_QUERY_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "LidoQueryError";
  }
}

export function lidoIriForEcli(ecli: string): string {
  return `${LIDO_JURISPRUDENTIE_IRI_PREFIX}${ecli}`;
}

const LINKTYPE_DICTIONARY: Record<string, { label: string; category: LidoLinkCategory }> = {
  "lx-referentie": { label: "Verwijst naar", category: "reference" },
  "rvr-referentie": { label: "Verwijst naar (redactioneel)", category: "reference" },
  "rvr-conclusie": { label: "Conclusie", category: "conclusion" },
  "rvr-conclusie-latereaanleg": { label: "Conclusie latere aanleg", category: "conclusion" },
  "rvr-conclusie-voorafgaand": { label: "Conclusie voorafgaand", category: "conclusion" },
  "rvr-eerdereaanleg": { label: "Eerdere aanleg", category: "procedure" },
  "rvr-latereaanleg": { label: "Latere aanleg", category: "procedure" },
  "rvr-annotatie": { label: "Annotatie", category: "annotation" },
  "rvr-vernietigt": { label: "Vernietigt", category: "annulment" },
  "rvr-bevestigt": { label: "Bevestigt", category: "affirmation" },
  "rvr-wijst-af": { label: "Wijst af", category: "annulment" },
};

function humanizeCode(code: string): string {
  const cleaned = code.replace(/^(lx|rvr)-/, "").replace(/-/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function classifyLinkType(iri: string): { code: string; label: string; category: LidoLinkCategory } {
  const code = iri.startsWith(LIDO_LINKTYPE_IRI_PREFIX)
    ? iri.slice(LIDO_LINKTYPE_IRI_PREFIX.length)
    : iri.split("/").pop() || iri;
  const known = LINKTYPE_DICTIONARY[code];
  if (known) return { code, ...known };
  return { code, label: humanizeCode(code), category: "other" };
}

function classifyIriKind(iri: string): LidoNodeKind {
  if (iri.startsWith(LIDO_JURISPRUDENTIE_IRI_PREFIX)) return "jurisprudentie";
  if (iri.includes(LIDO_BWB_IRI_FRAGMENT)) return "artikel";
  if (iri.includes(LIDO_OEP_IRI_FRAGMENT)) return "offpub";
  if (iri.includes("/terms/artikel/")) return "artikel";
  if (iri.includes("/terms/officielepublicatie/")) return "offpub";
  return "other";
}

function ecliFromIri(iri: string): string | undefined {
  return iri.startsWith(LIDO_JURISPRUDENTIE_IRI_PREFIX)
    ? iri.slice(LIDO_JURISPRUDENTIE_IRI_PREFIX.length)
    : undefined;
}

function dateFromTitleDdMmYyyy(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const m = /\b(\d{2})-(\d{2})-(\d{4})\b/.exec(title);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

type SubjectRef = { "@_type"?: string; "@_idref"?: string; "@_kleur"?: string; "@_label"?: string };
type Subject = {
  "@_id"?: string;
  "dcterms:creator"?: string | string[];
  "dcterms:title"?: string | string[];
  "dcterms:hasVersion"?: string | string[];
  "overheidrl:kleur"?: string;
  "overheidrl:heeft-rechtsgebied"?: string | string[];
  "inkomende-links"?: { "subject-ref"?: SubjectRef | SubjectRef[] };
  "uitgaande-links"?: { "subject-ref"?: SubjectRef | SubjectRef[] };
};
type GetLinksResponse = {
  lido?: {
    facetten?: { facet?: Array<{ "@_name"?: string; int?: unknown }> };
    subject?: Subject | Subject[];
  };
};

function subjectToNode(s: Subject): LidoNode | null {
  const iri = s["@_id"];
  if (!iri) return null;
  const kind = classifyIriKind(iri);
  const titles = asArray(s["dcterms:title"]).map(asText).filter(Boolean) as string[];
  const creators = asArray(s["dcterms:creator"]).map(asText).filter(Boolean) as string[];
  const label = titles[0] ?? creators[0] ?? iri;
  const deeplink = asArray(s["dcterms:hasVersion"]).map(asText).find((v) => v && /^https?:\/\//.test(v));
  const color = asText(s["overheidrl:kleur"]);
  const date = dateFromTitleDdMmYyyy(titles[0]);
  const rechtsgebied = asArray(s["overheidrl:heeft-rechtsgebied"]).map(asText).filter(Boolean)[0];
  const ecli = ecliFromIri(iri);

  return {
    id: ecli ?? iri,
    iri,
    kind,
    label,
    ...(creators[0] ? { court: creators[0] } : {}),
    ...(date ? { date } : {}),
    ...(rechtsgebied ? { rechtsgebied } : {}),
    ...(kind === "artikel" && titles[0] ? { bwbLabel: titles[0] } : {}),
    ...(color ? { color } : {}),
    ...(deeplink ? { deeplink } : {}),
  };
}

export interface LidoServiceOptions {
  endpoint?: string;
  timeoutMs?: number;
}

export class LidoService {
  private readonly endpoint: string;
  private readonly timeoutMs: number | undefined;

  constructor(opts: LidoServiceOptions = {}) {
    const rawEnv = process.env.LIDO_REST_ENDPOINT;
    this.endpoint = (opts.endpoint ?? rawEnv ?? LIDO_DEFAULT_ENDPOINT).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  private async fetchGetLinks(ecli: string, rows: number, direction: LidoLinkDirection): Promise<GetLinksResponse> {
    const params = new URLSearchParams({ "ext-id": ecli, output: "xml", rows: String(rows), start: "0" });
    if (direction === "in") params.set("link", "inkomend");
    if (direction === "out") params.set("link", "uitgaand");
    const url = `${this.endpoint}/get-links?${params.toString()}`;

    let raw: string;
    try {
      const resp = await httpRequest(url, {
        headers: { Accept: "application/xml" },
        ...(this.timeoutMs ? { timeoutMs: this.timeoutMs } : {}),
        acceptStatuses: (s) => s < 500,
      });
      if (resp.status >= 400) {
        throw new LidoQueryError(`LiDO get-links returned HTTP ${resp.status} for ${ecli}`);
      }
      raw = resp.text;
    } catch (err) {
      if (err instanceof LidoQueryError) throw err;
      throw new LidoQueryError(`LiDO get-links request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!raw.trim().startsWith("<")) {
      throw new LidoParseError(`LiDO get-links returned non-XML (first 120 chars: ${raw.slice(0, 120)}).`);
    }
    let parsed: GetLinksResponse;
    try {
      parsed = parseXml<GetLinksResponse>(raw);
    } catch (err) {
      throw new LidoParseError(`LiDO get-links XML parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!parsed?.lido) {
      throw new LidoParseError("LiDO get-links response missing <lido> root.");
    }
    return parsed;
  }

  async getEcliSubgraph(params: {
    ecli: string;
    direction?: LidoLinkDirection;
    limit?: number;
    linkTypeCodes?: string[];
  }): Promise<LidoSubgraph> {
    const ecli = params.ecli.trim();
    const direction: LidoLinkDirection = params.direction ?? "both";
    const limit = Math.max(1, Math.min(250, Math.floor(params.limit ?? 100)));
    const requestRows = direction === "both" ? Math.min(500, limit * 2) : limit;

    const resp = await this.fetchGetLinks(ecli, requestRows, direction);
    const lido = resp.lido ?? {};
    const centreIri = lidoIriForEcli(ecli);

    const allSubjects = asArray(lido.subject);
    const centerSubject = allSubjects.find((s) => s["@_id"] === centreIri);
    const neighbourSubjects = allSubjects.filter((s) => s["@_id"] && s["@_id"] !== centreIri);

    const center: LidoNode = centerSubject
      ? subjectToNode(centerSubject) ?? { id: ecli, iri: centreIri, kind: "jurisprudentie", label: ecli }
      : { id: ecli, iri: centreIri, kind: "jurisprudentie", label: ecli };

    const neighbourNodesByIri = new Map<string, LidoNode>();
    for (const s of neighbourSubjects) {
      const node = subjectToNode(s);
      if (node) neighbourNodesByIri.set(node.iri, node);
    }

    const rawOut = centerSubject ? asArray(centerSubject["uitgaande-links"]?.["subject-ref"]) : [];
    const rawIn = centerSubject ? asArray(centerSubject["inkomende-links"]?.["subject-ref"]) : [];

    const buildEdges = (refs: SubjectRef[], dir: "in" | "out"): LidoEdge[] =>
      refs
        .filter((r) => r && r["@_idref"])
        .map((r) => {
          const linkTypeIri = r["@_type"] ?? "";
          const other = r["@_idref"] ?? "";
          const { code, label, category } = classifyLinkType(linkTypeIri);
          const fromIri = dir === "out" ? centreIri : other;
          const toIri = dir === "out" ? other : centreIri;
          if (other && !neighbourNodesByIri.has(other) && other !== centreIri) {
            neighbourNodesByIri.set(other, {
              id: ecliFromIri(other) ?? other,
              iri: other,
              kind: classifyIriKind(other),
              label: r["@_label"] ?? ecliFromIri(other) ?? other,
              ...(r["@_kleur"] ? { color: r["@_kleur"] } : {}),
            });
          }
          return { from: fromIri, to: toIri, linkTypeIri, linkTypeCode: code, linkTypeLabel: label, linkCategory: category };
        });

    const filterCodes = params.linkTypeCodes?.length ? new Set(params.linkTypeCodes) : undefined;
    const keep = (e: LidoEdge) => !filterCodes || filterCodes.has(e.linkTypeCode);
    const outEdges = (direction === "in" ? [] : buildEdges(rawOut, "out")).filter(keep);
    const inEdges = (direction === "out" ? [] : buildEdges(rawIn, "in")).filter(keep);
    const allEdges = [...outEdges, ...inEdges];

    const connectedIris = new Set<string>();
    for (const e of allEdges) {
      if (e.from !== centreIri) connectedIris.add(e.from);
      if (e.to !== centreIri) connectedIris.add(e.to);
    }
    const nodes: LidoNode[] = [center];
    for (const iri of connectedIris) {
      const n = neighbourNodesByIri.get(iri);
      if (n) nodes.push(n);
    }

    const rawFacets = asArray(lido.facetten?.facet);
    const facetByName = new Map<string, Array<{ label: string; count: number }>>();
    for (const f of rawFacets) {
      const name = f["@_name"];
      if (!name) continue;
      const ints = asArray(f.int as unknown)
        .map((i) => {
          const rec = i as Record<string, unknown>;
          return { label: (rec["@_name"] as string) ?? "", count: Number((rec["#text"] as string) ?? 0) };
        })
        .filter((x) => x.label && Number.isFinite(x.count));
      if (ints.length) facetByName.set(name, ints);
    }
    const orgFacet = facetByName.get("obj_organisatie") ?? [];
    const jaarFacet = facetByName.get("obj_jaar") ?? [];

    const linkTypeCounts = new Map<string, { label: string; count: number }>();
    for (const e of allEdges) {
      const prev = linkTypeCounts.get(e.linkTypeCode);
      linkTypeCounts.set(e.linkTypeCode, { label: e.linkTypeLabel, count: (prev?.count ?? 0) + 1 });
    }

    let earliest: string | undefined;
    let latest: string | undefined;
    for (const jf of jaarFacet) {
      if (/^\d{4}$/.test(jf.label)) {
        if (!earliest || jf.label < earliest) earliest = jf.label;
        if (!latest || jf.label > latest) latest = jf.label;
      }
    }
    const neighbourDateRange = earliest && latest ? { earliest: `${earliest}-01-01`, latest: `${latest}-12-31` } : undefined;

    const stats: LidoSubgraphStats = {
      inboundCount: inEdges.length,
      outboundCount: outEdges.length,
      topRechtsgebieden: orgFacet.slice().sort((a, b) => b.count - a.count).slice(0, 6),
      topLinkTypes: Array.from(linkTypeCounts.entries())
        .map(([code, v]) => ({ code, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      ...(neighbourDateRange ? { neighbourDateRange } : {}),
    };

    return {
      center,
      nodes,
      edges: allEdges,
      stats,
      truncation: {
        incoming: direction !== "out" && rawIn.length >= requestRows,
        outgoing: direction !== "in" && rawOut.length >= requestRows,
      },
      endpoint: this.endpoint,
    };
  }
}

export const lidoService = new LidoService();
