import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocumentTools } from "./document-tools.js";
import { registerCreationTools } from "./creation-tools.js";
import { registerModificationTools } from "./modification-tools.js";
import { registerTextTools } from "./text-tools.js";
import { registerComponentTools } from "./component-tools.js";

// DaisyUI Edition - New tools
import { registerSearchTools } from "./search-tools.js";
import { registerCodegenTools } from "./codegen-tools.js";

/**
 * Register all Figma tools to the MCP server
 * @param server - The MCP server instance
 */
export function registerTools(server: McpServer): void {
  // Original tools
  registerDocumentTools(server);
  registerCreationTools(server);
  registerModificationTools(server);
  registerTextTools(server);
  registerComponentTools(server);

  // DaisyUI Edition - Additional tools
  registerSearchTools(server);   // Local index, search, DaisyUI mapping
  registerCodegenTools(server);  // Jinja/HTMX template generation, Page Objects
}

// Export all tool registration functions for individual usage if needed
export {
  registerDocumentTools,
  registerCreationTools,
  registerModificationTools,
  registerTextTools,
  registerComponentTools,
  // DaisyUI Edition
  registerSearchTools,
  registerCodegenTools
};
