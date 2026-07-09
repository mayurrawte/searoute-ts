# @searoute-ts/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
[`searoute-ts`](https://github.com/mayurrawte/searoute-ts) to AI agents, so they
can compute real shortest sea routes ("how far is Shanghai to Rotterdam by sea,
avoiding Suez?") instead of guessing.

It's a thin wrapper over the `searoute-ts` public API — no new routing logic —
and accepts UN/LOCODE **port codes** (e.g. `CNSHA`) as well as `[lon, lat]`
coordinates.

## Tools

### `sea_route`

Shortest maritime route between two points. Returns distance, optional duration,
the canals/straits traversed, detour ratio, and the route GeoJSON.

| Argument | Type | Notes |
| --- | --- | --- |
| `origin`, `destination` | port code `string` or `[lon, lat]` | required |
| `units` | `"nauticalmiles"` \| `"kilometers"` \| `"miles"` | default `nauticalmiles` |
| `restrictions` | passage name array | e.g. `["suez","babelmandeb"]` to force Cape of Good Hope |
| `allowArctic` | boolean | allow the (default-blocked) Northwest/Northeast Passages |
| `speedKnots` | number | fills an estimated duration in hours |
| `vesselDraftMeters` | number | auto-avoids canals too shallow for the vessel |
| `maxSnapDistanceKm` | number | reject inputs too far from the sea network |
| `includeGeometry` | boolean | include the route GeoJSON (default `true`) |

### `sea_route_alternatives`

Up to `k` distinct alternatives, each blocking a different combination of major
canals/straits (baseline vs. no-Suez vs. no-Panama …), sorted by distance —
useful for comparing "via Suez" against "via Cape of Good Hope".

## Install & run

```bash
npm install -g @searoute-ts/mcp   # or use npx, below
```

The server speaks MCP over stdio.

### Claude Code / `claude` CLI

```bash
claude mcp add searoute -- npx -y @searoute-ts/mcp
```

### Claude Desktop / generic MCP client config

```json
{
  "mcpServers": {
    "searoute": {
      "command": "npx",
      "args": ["-y", "@searoute-ts/mcp"]
    }
  }
}
```

## Example

> "What's the sea distance from Shanghai to Rotterdam, and how much longer is it
> if we avoid the Suez Canal?"

The agent calls `sea_route('CNSHA', 'NLRTM')` (≈ 19,753 km via Suez) and
`sea_route('CNSHA', 'NLRTM', { restrictions: ['suez', 'babelmandeb'] })`
(≈ 25,315 km via the Cape of Good Hope).

## Develop

```bash
npm install
npm run build     # tsc -> dist/
npm test          # vitest — exercises the tool handlers
npm run dev       # run from source with tsx
```

## License

MIT — see the [root repository](https://github.com/mayurrawte/searoute-ts).
