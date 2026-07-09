import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  runSeaRoute,
  runSeaRouteAlternatives,
  seaRouteAlternativesInputSchema,
  seaRouteInputSchema,
} from './tools.js';

/**
 * Build the searoute-ts MCP server with the `sea_route` and
 * `sea_route_alternatives` tools registered. The tools are thin wrappers over
 * the searoute-ts public API — no new routing logic.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'searoute-ts',
    version: '0.1.0',
  });

  server.registerTool(
    'sea_route',
    {
      title: 'Shortest sea route',
      description:
        'Compute the shortest maritime route between two points (UN/LOCODE port codes like "CNSHA", or [lon, lat] coordinates). Returns distance, optional duration, the canals/straits traversed, and the route GeoJSON. Supports passage restrictions (e.g. avoid Suez), arctic gating, and vessel-draft-aware canal avoidance.',
      inputSchema: seaRouteInputSchema,
    },
    async (args) => runSeaRoute(args),
  );

  server.registerTool(
    'sea_route_alternatives',
    {
      title: 'Alternative sea routes',
      description:
        'Return up to k distinct alternative maritime routes between two points, each blocking a different combination of major canals/straits (e.g. baseline vs. no-Suez vs. no-Panama), sorted by distance. Useful for comparing "via Suez" against "via Cape of Good Hope".',
      inputSchema: seaRouteAlternativesInputSchema,
    },
    async (args) => runSeaRouteAlternatives(args),
  );

  return server;
}
