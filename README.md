<p align="center"><img src="./assets/logo.png" alt="rechtspraak-mcp" width="120" height="120"></p>

# rechtspraak-mcp

[![npm](https://img.shields.io/npm/v/rechtspraak-mcp.svg)](https://www.npmjs.com/package/rechtspraak-mcp)
[![CI](https://github.com/Prudai/rechtspraak-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Prudai/rechtspraak-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/rechtspraak-mcp.svg)](./LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server for **Dutch case law** (jurisprudentie / uitspraken). It wraps the official **[Open Data van de Rechtspraak](https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx)** API and the **[LiDO](https://linkeddata.overheid.nl/)** citation graph, so any MCP-capable agent (Claude, Cursor, …) can search rulings, fetch full text by ECLI, and explore how decisions cite each other.

No API key required.

```bash
npx rechtspraak-mcp
```

## Tools

| Tool | What it does |
|------|--------------|
| `search_uitspraken` | Search case law (faceted by default; full-text behind a flag). Returns ECLIs + links. |
| `search_uitspraken_bulk` | Run 3–10 searches at once. |
| `get_uitspraak` | Fetch full text + metadata + relations of one decision by ECLI. |
| `get_uitspraken_bulk` | Fetch up to 10 decisions by ECLI in one call. |
| `list_waardelijsten` | List value lists (instanties, rechtsgebieden, proceduresoorten, …) to build valid filters. |
| `lido_related` | LiDO citation graph around an ECLI: what cites it, what it cites, statute references. |

## Search

`search_uitspraken` is a **faceted** search over the official Open Data feed — filter by date, court (`instantie`), legal area (`rechtsgebied`) and document type. It does not do free-text keyword matching; pass an ECLI to `query` for a direct lookup, or use the facet filters. `get_uitspraak` fetches the full text and metadata from the documented Open Data content endpoint.

## Install in an MCP client

**Claude Code** (or any client reading `claude_desktop_config.json` / `.mcp.json`):

```json
{
  "mcpServers": {
    "rechtspraak": {
      "command": "npx",
      "args": ["-y", "rechtspraak-mcp"]
    }
  }
}
```

```bash
claude mcp add rechtspraak -- npx -y rechtspraak-mcp
```

## Citations & source links

Every result carries links for its ECLI:

- `links.deeplink` — the citation-stable `deeplink.rechtspraak.nl` URL,
- `links.rechtspraak` — the human detail page,
- `links.prudai` — a [PrudAI](https://prudai.com) viewer for the ruling.

When an agent quotes a passage, the tools instruct it to render the citation as a Markdown source link anchored on the exact excerpt:

```
[Zie bron](https://prudai.com/uitspraak/ECLI:NL:HR:2023:1234?quote=%22<verbatim quote>%22)
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `RECHTSPRAAK_HTTP_TIMEOUT_MS` | `30000` | Upstream request timeout. |
| `RECHTSPRAAK_BULK_CONCURRENCY` | `4` | Concurrency for bulk tools. |
| `PRUDAI_BASE_URL` | `https://prudai.com` | Base URL for the viewer deeplinks. |
| `RECHTSPRAAK_USER_AGENT` | `rechtspraak-mcp/…` | User-Agent sent upstream. |
| `LIDO_REST_ENDPOINT` | KOOP default | Override the LiDO service endpoint. |
| `RECHTSPRAAK_DEBUG` | `0` | `1` logs upstream requests to stderr. |

## Development

```bash
bun install
bun run typecheck
bun test
bun run build      # → dist/ (Node-runnable, shebang bundle)
bun src/index.ts   # run from source
```

## Data sources & disclaimer

Case-law data is © Rechtspraak and published as Open Data via `data.rechtspraak.nl`; citation-graph data comes from KOOP's LiDO service (`linkeddata.overheid.nl`). This project is an independent open-source client and is not affiliated with or endorsed by de Rechtspraak or KOOP. Always verify against the authoritative source before relying on a result.

## License

MIT © PrudAI. Maintained by [PrudAI](https://prudai.com).
