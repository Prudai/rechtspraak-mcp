/**
 * ECLI parsing and validation. An ECLI has the shape:
 *   ECLI:<country>:<court>:<year>:<number>
 * e.g. ECLI:NL:HR:2023:1234. The local segments are case-sensitive, so normalization
 * only touches the literal "ECLI" token and the country code.
 */

export class InvalidEcliError extends Error {
  public readonly code = "ECLI_INVALID" as const;
  constructor(public readonly value: string, message?: string) {
    super(message || `Invalid ECLI: "${value}". Expected ECLI:CC:COURT:YYYY:NUMBER.`);
    this.name = "InvalidEcliError";
  }
}

export interface ParsedEcli {
  country: string;
  court: string;
  year: string;
  number: string;
  normalized: string;
}

// Country = 2 letters; year = 4 digits; court/number = non-colon runs.
// Case-insensitive on the "ECLI" token so "ecli:nl:..." normalizes cleanly; the
// court/number segments are preserved verbatim (they are case-sensitive in practice).
export const ECLI_PATTERN = /^ECLI:([A-Za-z]{2}):([^:]+):(\d{4}):([^:]+)$/i;

export function parseEcli(input: string): ParsedEcli {
  const raw = typeof input === "string" ? input.trim() : "";
  const match = ECLI_PATTERN.exec(raw);
  if (!match) {
    throw new InvalidEcliError(input);
  }
  const [, country, court, year, number] = match as unknown as [string, string, string, string, string];
  return {
    country,
    court,
    year,
    number,
    normalized: `ECLI:${country.toUpperCase()}:${court}:${year}:${number}`,
  };
}

export function isValidEcli(input: string): boolean {
  return ECLI_PATTERN.test(typeof input === "string" ? input.trim() : "");
}

/**
 * Tuchtrecht (Dutch disciplinary courts) ECLIs use instantie codes starting with "T"
 * (e.g. TAHVD, TADRSHE, TGZRAMS). Rechtspraak does not host these, so the Rechtspraak
 * tools short-circuit them with a helpful error instead of returning a confusing 404.
 */
export function isTuchtrechtEcli(input: string): boolean {
  const raw = typeof input === "string" ? input.trim() : "";
  const parts = raw.split(":");
  if (parts.length < 5) return false;
  if (parts[0] !== "ECLI" || parts[1] !== "NL") return false;
  return parts[2]!.startsWith("T");
}
