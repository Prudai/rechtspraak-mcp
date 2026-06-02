import { test, expect, beforeEach } from "bun:test";
import { prudaiViewerUrl, prudaiSourceLink, officialDeeplink, linksForEcli } from "../src/lib/prudai.js";
import { resetConfigForTests } from "../src/config.js";

const ECLI = "ECLI:NL:HR:2023:1234";

beforeEach(() => {
  delete process.env.PRUDAI_BASE_URL;
  resetConfigForTests();
});

test("prudaiViewerUrl without quote", () => {
  expect(prudaiViewerUrl(ECLI)).toBe(`https://prudai.com/uitspraak/${encodeURIComponent(ECLI)}`);
});

test("prudaiViewerUrl with quote wraps in double quotes and encodes", () => {
  const url = prudaiViewerUrl(ECLI, "een redelijke termijn");
  expect(url).toContain("?quote=");
  expect(url).toContain(encodeURIComponent('"een redelijke termijn"'));
});

test("prudaiSourceLink renders a Markdown link labelled Zie bron", () => {
  const link = prudaiSourceLink(ECLI, "goed verhuurderschap");
  expect(link.startsWith("[Zie bron](")).toBe(true);
  expect(link.endsWith(")")).toBe(true);
  expect(link).toContain(encodeURIComponent('"goed verhuurderschap"'));
});

test("officialDeeplink uses the citation-stable host", () => {
  expect(officialDeeplink(ECLI)).toBe(`https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(ECLI)}`);
});

test("linksForEcli bundles all three links", () => {
  const links = linksForEcli(ECLI);
  expect(links.prudai).toContain("prudai.com/uitspraak");
  expect(links.deeplink).toContain("deeplink.rechtspraak.nl");
  expect(links.rechtspraak).toContain("uitspraken.rechtspraak.nl/details");
});

test("PRUDAI_BASE_URL override is honoured and trailing slash stripped", () => {
  process.env.PRUDAI_BASE_URL = "https://staging.prudai.com/";
  resetConfigForTests();
  expect(prudaiViewerUrl(ECLI)).toBe(`https://staging.prudai.com/uitspraak/${encodeURIComponent(ECLI)}`);
});
