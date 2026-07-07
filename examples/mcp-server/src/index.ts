#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

/**
 * Entry point for the searoute-ts MCP server. Speaks the Model Context Protocol
 * over stdio, so it can be launched by any MCP client (Claude Desktop, the
 * `claude` CLI, etc.) — see the README for the `claude mcp add` snippet.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so we don't corrupt the stdio JSON-RPC stream on stdout.
  console.error('searoute-ts MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting searoute-ts MCP server:', err);
  process.exit(1);
});
