import { test, expect } from "bun:test";
import { extractEclis } from "../src/lib/ecli.js";
import { citedEclisFromDocument } from "../src/rechtspraak/citationNetwork.js";
import { getConfig, resetConfigForTests } from "../src/config.js";

test("extractEclis pulls, normalizes, dedupes and drops self, ignoring trailing punctuation", () => {
  const text =
    "Zie ECLI:NL:HR:2019:1278 en nogmaals ecli:nl:hr:2019:1278, vgl. ECLI:NL:PHR:2020:55. " +
    "Niet relevant: ECLI:NL:SELF:2021:9.";
  const got = extractEclis(text, { exclude: ["ECLI:NL:SELF:2021:9"] });
  expect(got).toEqual(["ECLI:NL:HR:2019:1278", "ECLI:NL:PHR:2020:55"]);
});

test("extractEclis returns [] on empty input", () => {
  expect(extractEclis("")).toEqual([]);
  expect(extractEclis("no citations here")).toEqual([]);
});

test("citedEclisFromDocument merges typed relations + body ECLIs and excludes self", () => {
  const doc = {
    ecli: "ECLI:NL:HR:2022:1",
    bodyText: "verwijst naar ECLI:NL:GHAMS:2020:30 en naar zichzelf ECLI:NL:HR:2022:1 (self)",
    relations: [{ ecli: "ECLI:NL:PHR:2021:7", type: "Conclusie" }],
  };
  const got = citedEclisFromDocument(doc);
  expect(got).toContain("ECLI:NL:PHR:2021:7"); // from relations
  expect(got).toContain("ECLI:NL:GHAMS:2020:30"); // from body
  expect(got).not.toContain("ECLI:NL:HR:2022:1"); // self excluded
});

test("citationNetwork config flag: default off, reads graph/lido, invalid -> off", () => {
  const prev = process.env.RECHTSPRAAK_CITATION_NETWORK;
  try {
    resetConfigForTests();
    delete process.env.RECHTSPRAAK_CITATION_NETWORK;
    expect(getConfig().citationNetwork).toBe("off");

    resetConfigForTests();
    process.env.RECHTSPRAAK_CITATION_NETWORK = "graph";
    expect(getConfig().citationNetwork).toBe("graph");

    resetConfigForTests();
    process.env.RECHTSPRAAK_CITATION_NETWORK = "LIDO";
    expect(getConfig().citationNetwork).toBe("lido");

    resetConfigForTests();
    process.env.RECHTSPRAAK_CITATION_NETWORK = "bogus";
    expect(getConfig().citationNetwork).toBe("off");
  } finally {
    if (prev === undefined) delete process.env.RECHTSPRAAK_CITATION_NETWORK;
    else process.env.RECHTSPRAAK_CITATION_NETWORK = prev;
    resetConfigForTests();
  }
});
