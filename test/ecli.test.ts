import { test, expect } from "bun:test";
import { parseEcli, isValidEcli, isTuchtrechtEcli, InvalidEcliError } from "../src/lib/ecli.js";

test("parseEcli splits a valid ECLI", () => {
  const p = parseEcli("ECLI:NL:HR:2023:1234");
  expect(p.country).toBe("NL");
  expect(p.court).toBe("HR");
  expect(p.year).toBe("2023");
  expect(p.number).toBe("1234");
  expect(p.normalized).toBe("ECLI:NL:HR:2023:1234");
});

test("parseEcli trims and uppercases country", () => {
  expect(parseEcli("  ecli:nl:HR:2023:1234  ").normalized).toBe("ECLI:NL:HR:2023:1234");
});

test("parseEcli rejects malformed input", () => {
  expect(() => parseEcli("NL:HR:2023:1234")).toThrow(InvalidEcliError);
  expect(() => parseEcli("ECLI:NL:HR:23:1234")).toThrow();
  expect(() => parseEcli("")).toThrow();
});

test("isValidEcli", () => {
  expect(isValidEcli("ECLI:NL:HR:2023:1234")).toBe(true);
  expect(isValidEcli("not an ecli")).toBe(false);
});

test("isTuchtrechtEcli detects T-prefixed instanties", () => {
  expect(isTuchtrechtEcli("ECLI:NL:TAHVD:2023:1")).toBe(true);
  expect(isTuchtrechtEcli("ECLI:NL:TGZRAMS:2022:99")).toBe(true);
  expect(isTuchtrechtEcli("ECLI:NL:HR:2023:1234")).toBe(false);
  expect(isTuchtrechtEcli("ECLI:CE:ECHR:2020:1")).toBe(false);
});
