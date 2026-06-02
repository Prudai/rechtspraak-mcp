import { test, expect } from "bun:test";
import { resolveRechtsgebied } from "../src/rechtspraak/openData.js";
import { ALL_TOOLS } from "../src/tools/index.js";

test("resolveRechtsgebied maps slugs to PSI URIs", () => {
  expect(resolveRechtsgebied("civielrecht")).toBe("http://psi.rechtspraak.nl/rechtsgebied#civielRecht");
  expect(resolveRechtsgebied("Strafrecht")).toBe("http://psi.rechtspraak.nl/rechtsgebied#strafrecht");
  expect(resolveRechtsgebied("internationaal publiekrecht")).toBe(
    "http://psi.rechtspraak.nl/rechtsgebied#internationaalPubliekrecht",
  );
});

test("resolveRechtsgebied passes through full URIs and unknown slugs", () => {
  const uri = "http://psi.rechtspraak.nl/rechtsgebied#belastingrecht";
  expect(resolveRechtsgebied(uri)).toBe(uri);
  expect(resolveRechtsgebied("onbekend")).toBe("onbekend");
});

test("all tools have unique snake_case names and a run function", () => {
  const names = ALL_TOOLS.map((t) => t.name);
  expect(new Set(names).size).toBe(names.length);
  for (const tool of ALL_TOOLS) {
    expect(tool.name).toMatch(/^[a-z_]+$/);
    expect(typeof tool.run).toBe("function");
    expect(tool.description.length).toBeGreaterThan(20);
  }
  expect(names).toEqual([
    "search_uitspraken",
    "search_uitspraken_bulk",
    "get_uitspraak",
    "get_uitspraken_bulk",
    "list_waardelijsten",
    "lido_related",
  ]);
});
