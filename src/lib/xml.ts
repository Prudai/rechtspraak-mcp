import { XMLParser } from "fast-xml-parser";

/**
 * Shared XML parser for the Atom search feed, the RDF/XML content documents, the
 * waardelijsten, and LiDO's get-links response. Attributes are kept (prefixed with
 * `@_`) because both the Atom `<link href>` and LiDO's `<subject-ref idref>` carry
 * their payload in attributes.
 */
export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
  allowBooleanAttributes: true,
  removeNSPrefix: false,
});

export function parseXml<T = unknown>(raw: string): T {
  return xmlParser.parse(raw) as T;
}

/** Normalize a value that fast-xml-parser may return as a single item or an array. */
export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extract a trimmed string from a scalar or a `{ "#text": ... }` node. */
export function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    const t = (value as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t.trim() || undefined;
    if (typeof t === "number") return String(t);
  }
  return undefined;
}
