/** The ECLI resolves but has no published body text (drafts, sealed, or metadata-only). */
export class RechtspraakNotPublishedError extends Error {
  public readonly code = "RECHTSPRAAK_NOT_PUBLISHED" as const;
  constructor(public readonly ecli: string, message?: string) {
    super(message || `Rechtspraak has no published uitspraak text for ECLI ${ecli}.`);
    this.name = "RechtspraakNotPublishedError";
  }
}

/** The ECLI was not found upstream (HTTP 404 on the content endpoint). */
export class RechtspraakNotFoundError extends Error {
  public readonly code = "RECHTSPRAAK_NOT_FOUND" as const;
  constructor(public readonly ecli: string, message?: string) {
    super(message || `No Rechtspraak document found for ECLI ${ecli}.`);
    this.name = "RechtspraakNotFoundError";
  }
}
