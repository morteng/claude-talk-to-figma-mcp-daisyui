/**
 * Search Tools - DaisyUI Edition
 *
 * Fast local search without Figma round-trips.
 * Uses SQLite FTS5 for fuzzy matching.
 *
 * AUTO-INDEXING: Index is built automatically on first query and kept in sync.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cache } from "../cache/index.js";
import { sendCommandToFigma, isConnected, onChangeNotification, ChangeNotification } from "../utils/websocket.js";
import { detectDaisyUIComponent, getComponentCategory, COMPONENT_USAGE_HINTS } from "../daisyui/index.js";
import {
  rgbToHex,
  matchDaisyUIColor,
  spacingToTailwind,
  fontSizeToTailwind,
  fontWeightToTailwind,
  radiusToTailwind,
  shadowToTailwind
} from "../daisyui/colors.js";
import { logger } from "../utils/logger.js";

// Auto-sync configuration
const INDEX_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
let lastSyncAttempt = 0;
let syncInProgress = false;
let indexInvalidated = false;

// Register change notification handler
onChangeNotification((notification: ChangeNotification) => {
  // Only invalidate on document changes (not selection or page changes)
  if (notification.changeType === 'document_change') {
    const details = notification.details;

    // Only invalidate if there were actual structural changes
    if (details.nodeCreations && details.nodeCreations > 0 ||
        details.nodeDeletions && details.nodeDeletions > 0 ||
        (details.propertyChanges && details.propertyChanges > 5)) { // Batch small property changes

      logger.info(`Index invalidated due to document change: ${details.nodeCreations || 0} creations, ${details.nodeDeletions || 0} deletions, ${details.propertyChanges || 0} property changes`);
      indexInvalidated = true;

      // Update metadata to force re-sync on next query
      try {
        cache.initialize();
        cache.setMeta('index_invalidated', 'true');
        cache.setMeta('invalidation_reason', `document_change:${notification.timestamp}`);
      } catch (error) {
        logger.error(`Failed to mark index as invalidated: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
});

/**
 * Build/refresh the index - core implementation
 */
async function buildIndexImpl(options: { pages?: string[], forceRebuild?: boolean } = {}): Promise<{
  success: boolean;
  nodesIndexed: number;
  componentsFound: number;
  pagesSynced: string[];
  error?: string;
}> {
  if (!isConnected()) {
    return { success: false, nodesIndexed: 0, componentsFound: 0, pagesSynced: [], error: "Not connected to Figma" };
  }

  try {
    cache.initialize();

    if (options.forceRebuild) {
      cache.clearAll();
      logger.info("Index cleared for rebuild");
    }

    // Get document info from Figma
    const docInfo = await sendCommandToFigma("get_document_info");
    const docPages = (docInfo as any).pages || [];

    // Filter pages if specified
    const targetPages = options.pages
      ? docPages.filter((p: any) => options.pages!.includes(p.name))
      : docPages;

    let totalNodes = 0;
    let totalComponents = 0;

    for (const page of targetPages) {
      // Get page structure
      const pageResult = await sendCommandToFigma("get_node_info", { nodeId: page.id });
      const pageData = pageResult as any;

      // Index nodes recursively
      const indexNode = (node: any, parentPath: string = '', depth: number = 0) => {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;

        // Detect DaisyUI mapping
        const daisyMapping = detectDaisyUIComponent(node.name, parentPath.split('/').pop() || '');

        // Extract Tailwind classes from styles (simplified)
        const tailwindClasses: string[] = [];
        if (node.layoutMode === 'HORIZONTAL') tailwindClasses.push('flex', 'flex-row');
        if (node.layoutMode === 'VERTICAL') tailwindClasses.push('flex', 'flex-col');
        if (node.cornerRadius) tailwindClasses.push(radiusToTailwind(node.cornerRadius));

        // Generate test ID from path
        const dataTestid = nodePath
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 64);

        // Simple hash for change detection
        const contentHash = Buffer.from(JSON.stringify({
          name: node.name,
          type: node.type,
          x: Math.round(node.x || 0),
          y: Math.round(node.y || 0),
          w: Math.round(node.width || 0),
          h: Math.round(node.height || 0)
        })).toString('base64').substring(0, 16);

        cache.upsertNode({
          figma_id: node.id,
          name: node.name,
          type: node.type,
          parent_id: node.parent?.id || null,
          page_id: page.id,
          path: nodePath,
          depth,
          component_key: node.componentPropertyReferences?.variant || null,
          component_name: node.type === 'COMPONENT' ? node.name : null,
          daisyui_class: daisyMapping?.class || null,
          daisyui_component: daisyMapping?.component || null,
          daisyui_variant: daisyMapping?.variant || null,
          daisyui_size: daisyMapping?.size || null,
          tailwind_classes: tailwindClasses.length ? JSON.stringify(tailwindClasses) : null,
          data_testid: dataTestid,
          x: node.x || null,
          y: node.y || null,
          width: node.width || null,
          height: node.height || null,
          content_hash: contentHash
        });

        totalNodes++;

        // Index as component if it's a component
        if (node.type === 'COMPONENT' && daisyMapping) {
          const hints = COMPONENT_USAGE_HINTS[daisyMapping.component];
          cache.upsertComponent({
            key: node.id,
            name: node.name,
            category: getComponentCategory(node.name, ''),
            subcategory: daisyMapping.variant || null,
            figma_id: node.id,
            daisyui_class: daisyMapping.class,
            tailwind_base: null,
            variants: null,
            default_variant: null,
            description: `${daisyMapping.component} component`,
            usage_hint: hints?.hint || null,
            example_contexts: hints ? JSON.stringify(hints.contexts) : null,
            clone_ready: true
          });
          totalComponents++;
        }

        // Recurse into children
        if (node.children) {
          for (const child of node.children) {
            indexNode(child, nodePath, depth + 1);
          }
        }
      };

      // Start indexing from page root
      if (pageData.children) {
        for (const child of pageData.children) {
          indexNode(child, page.name, 1);
        }
      }

      // Count nodes for page summary
      const nodeCount = cache.getNodesByType('FRAME', page.id).length;
      const componentCount = cache.getNodesByType('COMPONENT', page.id).length;
      const frameCount = cache.getNodesByType('FRAME', page.id).length;

      // Get main sections (top-level frames)
      const mainSections = pageData.children
        ?.filter((c: any) => c.type === 'FRAME')
        .map((c: any) => c.name) || [];

      cache.upsertPage({
        id: page.id,
        name: page.name,
        node_count: nodeCount,
        component_count: componentCount,
        frame_count: frameCount,
        summary: `Page with ${frameCount} frames and ${componentCount} components`,
        main_sections: JSON.stringify(mainSections)
      });
    }

    // Update sync metadata
    cache.setMeta('last_full_sync', new Date().toISOString());
    cache.setMeta('document_name', (docInfo as any).name || 'Unknown');
    lastSyncAttempt = Date.now();

    return {
      success: true,
      nodesIndexed: totalNodes,
      componentsFound: totalComponents,
      pagesSynced: targetPages.map((p: any) => p.name)
    };
  } catch (error) {
    return {
      success: false,
      nodesIndexed: 0,
      componentsFound: 0,
      pagesSynced: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Ensure the index is ready - auto-builds if empty, stale, or invalidated by document changes
 * Called automatically before any search operation
 */
async function ensureIndex(): Promise<{ ready: boolean; autoBuilt: boolean; message?: string }> {
  if (syncInProgress) {
    return { ready: false, autoBuilt: false, message: "Sync already in progress" };
  }

  cache.initialize();
  const stats = cache.getStats();
  const lastSync = cache.getMeta('last_full_sync');
  const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
  const now = Date.now();

  // Check for invalidation from change notifications
  const metaInvalidated = cache.getMeta('index_invalidated') === 'true';
  const wasInvalidated = indexInvalidated || metaInvalidated;

  // Index is ready if it has nodes and was synced recently and not invalidated
  const hasNodes = stats.node_count > 0;
  const isStale = (now - lastSyncTime) > INDEX_STALE_THRESHOLD_MS;
  const shouldSync = !hasNodes || wasInvalidated || (isStale && (now - lastSyncAttempt) > 60000); // Don't retry more than once per minute

  if (!shouldSync && hasNodes) {
    return { ready: true, autoBuilt: false };
  }

  // Auto-build the index
  if (!isConnected()) {
    if (hasNodes) {
      // Use stale index if not connected
      return { ready: true, autoBuilt: false, message: "Using cached index (not connected to Figma)" };
    }
    return { ready: false, autoBuilt: false, message: "Not connected to Figma. Use join_channel first." };
  }

  syncInProgress = true;
  const syncReason = wasInvalidated ? "document changes detected" : (!hasNodes ? "empty index" : "stale index");
  logger.info(`Auto-building index (reason: ${syncReason})...`);

  try {
    const result = await buildIndexImpl();
    syncInProgress = false;

    if (result.success) {
      // Clear invalidation flags on successful sync
      indexInvalidated = false;
      cache.setMeta('index_invalidated', 'false');
      cache.setMeta('invalidation_reason', '');

      logger.info(`Index built: ${result.nodesIndexed} nodes, ${result.componentsFound} components`);
      return { ready: true, autoBuilt: true, message: `Auto-indexed ${result.nodesIndexed} nodes (${syncReason})` };
    } else {
      return { ready: hasNodes, autoBuilt: false, message: result.error };
    }
  } catch (error) {
    syncInProgress = false;
    return { ready: hasNodes, autoBuilt: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Register search-related tools
 */
export function registerSearchTools(server: McpServer): void {

  // ============================================================
  // INDEX MANAGEMENT
  // ============================================================

  /**
   * Build/rebuild the local index from Figma
   * NOTE: Index is also auto-built on first search if empty or stale
   */
  server.tool(
    "build_index",
    "Manually rebuild the local index from Figma. Usually not needed - index auto-builds on first query and stays in sync. Use force_rebuild=true to clear and rebuild from scratch.",
    {
      pages: z.array(z.string()).optional().describe("Specific page names to index (default: all pages)"),
      force_rebuild: z.boolean().optional().default(false).describe("Clear existing index and rebuild from scratch"),
    },
    async ({ pages, force_rebuild }) => {
      const result = await buildIndexImpl({ pages, forceRebuild: force_rebuild });
      const stats = cache.getStats();

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              nodes_indexed: result.nodesIndexed,
              components_found: result.componentsFound,
              pages_synced: result.pagesSynced,
              stats
            }, null, 2)
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Error building index: ${result.error}`
          }]
        };
      }
    }
  );

  /**
   * Get index status
   */
  server.tool(
    "index_status",
    "Check the status of the local Figma index. Shows node count, last sync time, and whether the index needs refresh.",
    {},
    async () => {
      try {
        cache.initialize();
        const stats = cache.getStats();
        const documentName = cache.getMeta('document_name');
        const schemaVersion = cache.getMeta('schema_version');

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              document_name: documentName || 'Not synced',
              schema_version: schemaVersion,
              ...stats,
              is_ready: stats.node_count > 0
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting index status: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // ============================================================
  // SEARCH
  // ============================================================

  /**
   * Search nodes by natural language query
   * Auto-indexes on first use if needed
   */
  server.tool(
    "search",
    "Search Figma nodes by natural language query. Uses FTS5 for fuzzy matching. Examples: 'primary button', 'login form', 'dashboard stats'. Auto-indexes on first use.",
    {
      query: z.string().describe("Search query (e.g., 'primary button', 'form input', 'card with image')"),
      type: z.enum(["FRAME", "COMPONENT", "INSTANCE", "TEXT", "GROUP"]).optional().describe("Filter by node type"),
      page: z.string().optional().describe("Filter by page name"),
      limit: z.number().optional().default(10).describe("Maximum results (default: 10)")
    },
    async ({ query, type, page, limit }) => {
      try {
        // Auto-index if needed
        const indexStatus = await ensureIndex();
        if (!indexStatus.ready) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "Index not ready",
                message: indexStatus.message,
                suggestion: "Connect to Figma first with join_channel"
              }, null, 2)
            }]
          };
        }

        // Get page ID if page name provided
        let pageId: string | undefined;
        if (page) {
          const pages = cache.getPages();
          const targetPage = pages.find(p => p.name.toLowerCase().includes(page.toLowerCase()));
          pageId = targetPage?.id;
        }

        const results = cache.searchNodes(query, {
          type,
          pageId,
          limit
        });

        // Format results with clone commands
        const formatted = results.map(r => ({
          figma_id: r.figma_id,
          name: r.name,
          path: r.path,
          type: r.type,
          daisyui_class: r.daisyui_class,
          clone_command: `mcp__figma__clone_node(nodeId="${r.figma_id}")`,
          relevance: Math.round(r.relevance * 100) / 100
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              results_count: formatted.length,
              results: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * List components by category
   */
  server.tool(
    "list_components",
    "List all components in a category. Categories: buttons, forms, cards, navigation, feedback, data-display, layout, misc.",
    {
      category: z.string().describe("Component category (buttons, forms, cards, navigation, feedback, data-display, layout, misc)"),
      limit: z.number().optional().default(20).describe("Maximum results")
    },
    async ({ category, limit }) => {
      try {
        cache.initialize();
        const components = cache.getComponentsByCategory(category).slice(0, limit);

        const formatted = components.map(c => ({
          key: c.key,
          name: c.name,
          daisyui_class: c.daisyui_class,
          usage_hint: c.usage_hint,
          clone_command: `mcp__figma__clone_node(nodeId="${c.figma_id}")`,
          usage_count: c.usage_count
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              category,
              count: formatted.length,
              components: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing components: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * Get component by DaisyUI class
   */
  server.tool(
    "get_by_daisyui",
    "Find a Figma component by its DaisyUI class name. Fast direct lookup.",
    {
      daisyui_class: z.string().describe("DaisyUI class (e.g., 'btn-primary', 'card', 'input-bordered')")
    },
    async ({ daisyui_class }) => {
      try {
        cache.initialize();

        // Search nodes with this DaisyUI class
        const nodes = cache.getNodesByDaisyUI(daisyui_class.split(' ')[0].replace('btn-', '').replace('input-', ''));

        if (nodes.length === 0) {
          // Try component lookup
          const component = cache.getComponentByClass(daisyui_class);
          if (component) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  found: true,
                  type: 'component',
                  ...component,
                  clone_command: `mcp__figma__clone_node(nodeId="${component.figma_id}")`
                }, null, 2)
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                found: false,
                message: `No component found with class: ${daisyui_class}`,
                suggestion: "Try building the index first with build_index, or search with a broader query"
              }, null, 2)
            }]
          };
        }

        const formatted = nodes.slice(0, 5).map(n => ({
          figma_id: n.figma_id,
          name: n.name,
          path: n.path,
          daisyui_class: n.daisyui_class,
          clone_command: `mcp__figma__clone_node(nodeId="${n.figma_id}")`
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              count: nodes.length,
              results: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * List all pages
   */
  server.tool(
    "list_pages",
    "List all pages in the Figma document with their summaries.",
    {},
    async () => {
      try {
        cache.initialize();
        const pages = cache.getPages();

        const formatted = pages.map(p => ({
          id: p.id,
          name: p.name,
          node_count: p.node_count,
          frame_count: p.frame_count,
          component_count: p.component_count,
          summary: p.summary,
          main_sections: p.main_sections ? JSON.parse(p.main_sections) : []
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              page_count: formatted.length,
              pages: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing pages: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * Get page tree structure
   */
  server.tool(
    "get_page_tree",
    "Get hierarchical structure of a page. Much smaller than full document export.",
    {
      page: z.string().describe("Page name or ID"),
      max_depth: z.number().optional().default(3).describe("Maximum depth to traverse (default: 3)"),
      include_instances: z.boolean().optional().default(false).describe("Include component instances")
    },
    async ({ page, max_depth, include_instances }) => {
      try {
        cache.initialize();

        // Find page
        const pages = cache.getPages();
        const targetPage = pages.find(p =>
          p.id === page || p.name.toLowerCase().includes(page.toLowerCase())
        );

        if (!targetPage) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `Page not found: ${page}` })
            }]
          };
        }

        // Get nodes for this page
        const allNodes = cache.getNodesByType('FRAME', targetPage.id, 1000);

        // Build tree (simplified)
        interface TreeNode {
          id: string;
          name: string;
          type: string;
          daisyui?: string;
          children?: TreeNode[];
          child_count?: number;
        }

        const buildTree = (parentPath: string, depth: number): TreeNode[] => {
          if (depth > max_depth) return [];

          return allNodes
            .filter(n => {
              const parts = n.path.split('/');
              return parts.length === depth + 1 && n.path.startsWith(parentPath);
            })
            .filter(n => include_instances || n.type !== 'INSTANCE')
            .map(n => {
              const children = buildTree(n.path, depth + 1);
              return {
                id: n.figma_id,
                name: n.name,
                type: n.type,
                daisyui: n.daisyui_class || undefined,
                children: children.length > 0 ? children : undefined,
                child_count: children.length === 0 ? undefined : children.length
              };
            });
        };

        const tree = buildTree(targetPage.name, 1);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              page: targetPage.name,
              page_id: targetPage.id,
              tree
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
}
