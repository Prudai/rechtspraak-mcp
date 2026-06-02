# Distribution & adoption playbook

How to get `rechtspraak-mcp` listed everywhere people discover MCP servers. **Do these in order — every directory depends on the package being published first.**

> Note: `modelcontextprotocol/servers` no longer accepts community-server README PRs — it now redirects everyone to the official **MCP Registry**, which most other directories (PulseMCP, Glama, mcp.so) ingest from. Publish to the Registry and it propagates.

## Step 0 — Publish (prerequisite for all listings)

1. **npm**: `npm publish --access public` (or push a `vX.Y.Z` GitHub release → `.github/workflows/publish.yml` does npm + Registry automatically).
   - Requires `NPM_TOKEN` repo secret and that you publish as a **Prudai GitHub org member** (the Registry validates the `io.github.Prudai` namespace via OIDC against org membership).
2. Confirm `npx -y rechtspraak-mcp` runs for a clean user.

Files already prepared in-repo: `package.json` (`mcpName`), `server.json`, `smithery.yaml`, `.github/workflows/publish.yml` (npm + Registry on release).

## Step 1 — Official MCP Registry (highest value, propagates)

If the release workflow didn't run it, publish manually:
```bash
brew install mcp-publisher              # or curl the latest release tarball
mcp-publisher login github              # device-code flow
mcp-publisher publish                   # reads ./server.json
```
The Registry stores metadata only; the npm publish must have succeeded first.

## Step 2 — punkpeye/awesome-mcp-servers (fast, high-visibility) — PR

Add to the `### ⚖️ Legal` section, **alphabetical by repo path** (lands near `philrox/ris-mcp-ts` and `JamesANZ/us-legal-mcp`):

```
- [Prudai/rechtspraak-mcp](https://github.com/Prudai/rechtspraak-mcp) 📇 🏠 - Access Dutch case law (jurisprudentie) via Rechtspraak Open Data and the LiDO citation graph. Search and fetch uitspraken by ECLI.
```
Legend: `📇` = TypeScript/JS, `🏠` = local stdio service. One server per line, follow existing style. No npm/stars requirement.

Also consider PRs to `wong2/awesome-mcp-servers` and `cursor/mcp-servers` (same markdown-line style — check each README's legend first).

## Step 3 — mcp.so — Submit (GitHub issue / form)

Provide: name `rechtspraak-mcp`; description "MCP server for Dutch case law — search & fetch uitspraken by ECLI via Rechtspraak Open Data + LiDO"; tool count **6**; transport **stdio**; repo `https://github.com/Prudai/rechtspraak-mcp`; homepage `https://prudai.com`.

## Step 4 — Auto-crawlers (claim, don't submit)

- **Glama** (glama.ai/mcp/servers) — auto-indexes public repos and scores them; use "Add Server" to claim/speed up. A clean build + clear README improves the score.
- **PulseMCP** (pulsemcp.com/submit) — crawler + Registry sync; the form just accelerates it.

## Step 5 — Smithery

Push (the `smithery.yaml` is in-repo) → connect GitHub at smithery.ai (or claim the auto-listed server) → Deployments tab.

## Step 6 — Cline Marketplace — GitHub issue

Open an issue at `cline/mcp-marketplace` with: repo URL, a **400×400 PNG logo**, and a short rationale. Legal is a sensitive domain → state plainly in the issue and README that the server reads **only public open data (Rechtspraak Open Data, LiDO), no credentials, no PII**. Verify Cline can install it from the README alone before submitting.

## Step 7 — Cursor Directory

Submit at cursor.directory/plugins/new (web form).

---

### Parallelizable once published
Steps 2–7 are independent and can be opened concurrently (e.g. a subagent per target) *after* Step 0–1 are live and credentials are available. Steps 0–1 are strictly sequential and gated on your npm/GitHub auth.
