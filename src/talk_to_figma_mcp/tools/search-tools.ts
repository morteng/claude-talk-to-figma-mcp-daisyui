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
  hexToHsl,
  hslToString,
  matchDaisyUIColor,
  matchTailwindColor,
  classifyVariable,
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
  variablesIndexed: number;
  collectionsIndexed: number;
  pagesSynced: string[];
  error?: string;
}> {
  if (!isConnected()) {
    return { success: false, nodesIndexed: 0, componentsFound: 0, variablesIndexed: 0, collectionsIndexed: 0, pagesSynced: [], error: "Not connected to Figma" };
  }

  try {
    // Get document info from Figma FIRST to get the document ID
    const docInfo = await sendCommandToFigma("get_document_info");
    const docId = (docInfo as any).id || (docInfo as any).key;
    const docPages = (docInfo as any).pages || [];

    // Set the document ID to use the correct database file
    if (docId) {
      cache.setDocumentId(docId);
    }

    cache.initialize();

    if (options.forceRebuild) {
      cache.clearAll();
      logger.info("Index cleared for rebuild");
    }

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

      // Insert page FIRST to satisfy foreign key constraint
      // (we'll update the counts later)
      cache.upsertPage({
        id: page.id,
        name: page.name,
        node_count: 0,
        component_count: 0,
        frame_count: 0,
        summary: `Page: ${page.name}`,
        main_sections: JSON.stringify([])
      });

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

    // Sync variables and collections
    let totalVariables = 0;
    let totalCollections = 0;

    try {
      // Get variable collections
      const collectionsResult = await sendCommandToFigma("get_variable_collections");
      const collections = (collectionsResult as any).collections || [];

      for (const collection of collections) {
        cache.upsertVariableCollection({
          id: collection.id,
          name: collection.name,
          modes: JSON.stringify(collection.modes || []),
          default_mode_id: collection.defaultModeId || null,
          variable_count: collection.variableIds?.length || 0,
        });
        totalCollections++;
      }

      // Get all local variables
      const variablesResult = await sendCommandToFigma("get_local_variables");
      const variablesByCollection = (variablesResult as any).variables || {};

      for (const collectionName in variablesByCollection) {
        const variables = variablesByCollection[collectionName] || [];

        for (const variable of variables) {
          // Convert RGB to hex if available (for color variables)
          let hex: string | null = null;
          let rgb: string | null = null;
          let hsl: string | null = null;

          if (variable.resolvedType === 'COLOR' && variable.valuesByMode) {
            const firstModeValue = Object.values(variable.valuesByMode)[0] as any;
            if (firstModeValue && typeof firstModeValue === 'object' && 'r' in firstModeValue) {
              const r = Math.round((firstModeValue.r || 0) * 255);
              const g = Math.round((firstModeValue.g || 0) * 255);
              const b = Math.round((firstModeValue.b || 0) * 255);
              hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              rgb = `rgb(${r}, ${g}, ${b})`;
              // Convert to HSL
              const hslValue = hexToHsl(hex);
              hsl = hslToString(hslValue);
            }
          }

          // Use the comprehensive classifyVariable function
          const classification = classifyVariable(variable.name, variable.resolvedType || 'STRING', hex || undefined);

          // Check if this is an alias (references another variable)
          let isAlias = 0;
          let aliasTargetId: string | null = null;
          if (variable.valuesByMode) {
            const firstModeValue = Object.values(variable.valuesByMode)[0] as any;
            if (firstModeValue && typeof firstModeValue === 'object' && firstModeValue.type === 'VARIABLE_ALIAS') {
              isAlias = 1;
              aliasTargetId = firstModeValue.id || null;
            }
          }

          cache.upsertVariable({
            id: variable.id,
            name: variable.name,
            collection_id: variable.collectionId || '',
            resolved_type: variable.resolvedType || 'STRING',
            daisyui_name: classification.daisyuiName || null,
            daisyui_category: classification.daisyuiCategory || null,
            values_by_mode: variable.valuesByMode ? JSON.stringify(variable.valuesByMode) : null,
            hex,
            rgb,
            hsl,
            description: variable.description || null,
            scopes: variable.scopes ? JSON.stringify(variable.scopes) : null,
            // New enhanced fields
            tailwind_name: classification.tailwindName || null,
            tailwind_shade: classification.tailwindShade || null,
            color_system: classification.colorSystem || null,
            semantic_role: classification.semanticRole || null,
            token_type: classification.tokenType || null,
            css_variable: classification.cssVariable || null,
            tailwind_class: classification.tailwindClass || null,
            is_alias: isAlias,
            alias_target_id: aliasTargetId,
            usage_count: 0,
          });
          totalVariables++;

          // Also store per-mode values for multi-theme support
          if (variable.valuesByMode) {
            // Get mode names from collection
            const collection = collections.find((c: any) => c.id === variable.collectionId);
            const modes = collection?.modes || [];

            for (const [modeId, modeValue] of Object.entries(variable.valuesByMode)) {
              const mode = modes.find((m: any) => m.modeId === modeId);
              const modeName = mode?.name || modeId;

              let modeHex: string | null = null;
              let modeRgb: string | null = null;
              let modeHsl: string | null = null;
              let floatValue: number | null = null;
              let stringValue: string | null = null;
              let booleanValue: number | null = null;
              let isModeAlias = 0;
              let aliasModeVarId: string | null = null;

              const mv = modeValue as any;

              // Check if this mode value is an alias
              if (mv && typeof mv === 'object' && mv.type === 'VARIABLE_ALIAS') {
                isModeAlias = 1;
                aliasModeVarId = mv.id || null;
              } else if (variable.resolvedType === 'COLOR' && mv && typeof mv === 'object' && 'r' in mv) {
                const r = Math.round((mv.r || 0) * 255);
                const g = Math.round((mv.g || 0) * 255);
                const b = Math.round((mv.b || 0) * 255);
                modeHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                modeRgb = `rgb(${r}, ${g}, ${b})`;
                const hslVal = hexToHsl(modeHex);
                modeHsl = hslToString(hslVal);
              } else if (variable.resolvedType === 'FLOAT' && typeof mv === 'number') {
                floatValue = mv;
              } else if (variable.resolvedType === 'STRING' && typeof mv === 'string') {
                stringValue = mv;
              } else if (variable.resolvedType === 'BOOLEAN' && typeof mv === 'boolean') {
                booleanValue = mv ? 1 : 0;
              }

              cache.upsertVariableModeValue({
                variable_id: variable.id,
                mode_id: modeId,
                mode_name: modeName,
                raw_value: JSON.stringify(modeValue),
                hex: modeHex,
                rgb: modeRgb,
                hsl: modeHsl,
                float_value: floatValue,
                string_value: stringValue,
                boolean_value: booleanValue,
                is_alias: isModeAlias,
                alias_variable_id: aliasModeVarId,
              });
            }
          }
        }
      }
    } catch (varError) {
      // Variable sync is optional - log error but don't fail the whole sync
      logger.warn(`Failed to sync variables: ${varError instanceof Error ? varError.message : String(varError)}`);
    }

    // Update sync metadata
    cache.setMeta('last_full_sync', new Date().toISOString());
    cache.setMeta('document_name', (docInfo as any).name || 'Unknown');
    lastSyncAttempt = Date.now();

    return {
      success: true,
      nodesIndexed: totalNodes,
      componentsFound: totalComponents,
      variablesIndexed: totalVariables,
      collectionsIndexed: totalCollections,
      pagesSynced: targetPages.map((p: any) => p.name)
    };
  } catch (error) {
    return {
      success: false,
      nodesIndexed: 0,
      componentsFound: 0,
      variablesIndexed: 0,
      collectionsIndexed: 0,
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

  // If connected, get document ID and switch to correct database
  if (isConnected()) {
    try {
      const docInfo = await sendCommandToFigma("get_document_info");
      const docId = (docInfo as any).id || (docInfo as any).key;
      if (docId) {
        cache.setDocumentId(docId);
      }
    } catch (error) {
      // Continue with current database if we can't get document info
      logger.warn(`Could not get document ID: ${error instanceof Error ? error.message : String(error)}`);
    }
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

      logger.info(`Index built: ${result.nodesIndexed} nodes, ${result.componentsFound} components, ${result.variablesIndexed} variables`);
      return { ready: true, autoBuilt: true, message: `Auto-indexed ${result.nodesIndexed} nodes, ${result.variablesIndexed} variables (${syncReason})` };
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
              variables_indexed: result.variablesIndexed,
              collections_indexed: result.collectionsIndexed,
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
        // If connected, switch to correct database for current document
        if (isConnected()) {
          try {
            const docInfo = await sendCommandToFigma("get_document_info");
            const docId = (docInfo as any).id || (docInfo as any).key;
            if (docId) {
              cache.setDocumentId(docId);
            }
          } catch (error) {
            // Continue with current database
          }
        }

        cache.initialize();
        const stats = cache.getStats();
        const documentName = cache.getMeta('document_name');
        const documentId = cache.getDocumentId();
        const schemaVersion = cache.getMeta('schema_version');

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              document_name: documentName || 'Not synced',
              document_id: documentId || 'Not set',
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

  /**
   * List all cached documents
   */
  server.tool(
    "list_cached_documents",
    "List all Figma documents that have been indexed and cached locally. Each document has its own SQLite database.",
    {},
    async () => {
      try {
        const documents = cache.listCachedDocuments();

        const formatted = documents.map(doc => ({
          document_id: doc.documentId,
          size_kb: Math.round(doc.size / 1024),
          last_modified: doc.lastModified.toISOString()
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              cached_documents: formatted.length,
              current_document: cache.getDocumentId() || 'None',
              documents: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing cached documents: ${error instanceof Error ? error.message : String(error)}`
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

  // ============================================================
  // VARIABLE SEARCH (from local cache)
  // ============================================================

  /**
   * Search cached variables
   */
  server.tool(
    "search_cached_variables",
    "Search locally cached Figma variables by name or DaisyUI mapping. Fast lookup without Figma round-trip. Use build_index first to populate the cache.",
    {
      query: z.string().describe("Search query (e.g., 'primary', 'base-100', 'neutral')"),
      type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional().describe("Filter by variable type"),
      limit: z.number().optional().default(20).describe("Maximum results (default: 20)")
    },
    async ({ query, type, limit }) => {
      try {
        cache.initialize();

        const results = cache.searchVariables(query, {
          type,
          limit
        });

        const formatted = results.map(v => ({
          id: v.id,
          name: v.name,
          type: v.resolved_type,
          daisyui_name: v.daisyui_name,
          hex: v.hex,
          bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
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
            text: `Error searching variables: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * List all cached color variables
   */
  server.tool(
    "list_cached_color_variables",
    "List all color variables from the local cache. Organized by DaisyUI semantic names. Use build_index first to populate the cache.",
    {
      collection: z.string().optional().describe("Filter by collection name")
    },
    async ({ collection }) => {
      try {
        cache.initialize();

        let variables = cache.getColorVariables();

        // Filter by collection if specified
        if (collection) {
          const collections = cache.getVariableCollections();
          const targetCollection = collections.find(c =>
            c.name.toLowerCase().includes(collection.toLowerCase())
          );
          if (targetCollection) {
            variables = variables.filter(v => v.collection_id === targetCollection.id);
          }
        }

        // Group by DaisyUI category
        const grouped: Record<string, any[]> = {
          primary: [],
          secondary: [],
          accent: [],
          neutral: [],
          base: [],
          state: [],
          content: [],
          other: []
        };

        for (const v of variables) {
          const category = v.daisyui_category || 'other';
          const targetGroup = grouped[category] || grouped.other;
          targetGroup.push({
            id: v.id,
            name: v.name,
            daisyui_name: v.daisyui_name,
            hex: v.hex,
            bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
          });
        }

        // Remove empty groups
        for (const key in grouped) {
          if (grouped[key].length === 0) {
            delete grouped[key];
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: variables.length,
              by_category: grouped
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing color variables: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * List variable collections
   */
  server.tool(
    "list_cached_variable_collections",
    "List all variable collections from the local cache. Shows collection names, modes (e.g., light/dark), and variable counts.",
    {},
    async () => {
      try {
        cache.initialize();

        const collections = cache.getVariableCollections();

        const formatted = collections.map(c => ({
          id: c.id,
          name: c.name,
          modes: c.modes ? JSON.parse(c.modes) : [],
          default_mode_id: c.default_mode_id,
          variable_count: c.variable_count
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              collection_count: formatted.length,
              collections: formatted
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing variable collections: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * Get variable by DaisyUI name
   */
  server.tool(
    "get_cached_variable_by_daisyui",
    "Find a cached variable by its DaisyUI semantic name (e.g., 'primary', 'base-100', 'neutral'). Fast direct lookup.",
    {
      daisyui_name: z.string().describe("DaisyUI semantic name (e.g., 'primary', 'base-100', 'neutral-content')")
    },
    async ({ daisyui_name }) => {
      try {
        cache.initialize();

        const variable = cache.getVariableByDaisyUIName(daisyui_name);

        if (!variable) {
          // Try fuzzy search
          const results = cache.searchVariables(daisyui_name, { type: 'COLOR', limit: 5 });

          if (results.length > 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  found: false,
                  exact_match: false,
                  suggestions: results.map(r => ({
                    id: r.id,
                    name: r.name,
                    daisyui_name: r.daisyui_name,
                    hex: r.hex
                  }))
                }, null, 2)
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                found: false,
                message: `No variable found with DaisyUI name: ${daisyui_name}`,
                suggestion: "Try building the index with build_index, or search with search_cached_variables"
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              id: variable.id,
              name: variable.name,
              daisyui_name: variable.daisyui_name,
              daisyui_category: variable.daisyui_category,
              resolved_type: variable.resolved_type,
              hex: variable.hex,
              rgb: variable.rgb,
              bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${variable.id}")`
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

  // ============================================================
  // ENHANCED VARIABLE TOOLS (V2)
  // ============================================================

  /**
   * List Tailwind color variables
   */
  server.tool(
    "list_tailwind_color_variables",
    "List all Tailwind CSS color variables from the local cache. Groups by color name (slate, blue, etc.) with shades.",
    {
      color_name: z.string().optional().describe("Filter by Tailwind color name (e.g., 'blue', 'slate', 'emerald')")
    },
    async ({ color_name }) => {
      try {
        cache.initialize();

        const groupedVariables = cache.getTailwindColorVariables();

        // Filter if color name specified
        let result: Record<string, any[]> = {};
        if (color_name) {
          const colorLower = color_name.toLowerCase();
          if (groupedVariables[colorLower]) {
            result[colorLower] = groupedVariables[colorLower].map(v => ({
              id: v.id,
              name: v.name,
              shade: v.tailwind_shade,
              hex: v.hex,
              tailwind_class: v.tailwind_class,
              bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
            }));
          }
        } else {
          for (const [colorName, vars] of Object.entries(groupedVariables)) {
            result[colorName] = vars.map(v => ({
              id: v.id,
              name: v.name,
              shade: v.tailwind_shade,
              hex: v.hex,
              tailwind_class: v.tailwind_class,
              bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
            }));
          }
        }

        const totalCount = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: totalCount,
              color_families: Object.keys(result).length,
              by_color: result
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing Tailwind colors: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * List variables by color system
   */
  server.tool(
    "list_variables_by_color_system",
    "List all variables organized by color system (daisyui, tailwind, custom, brand).",
    {
      system: z.enum(["daisyui", "tailwind", "custom", "brand"]).optional().describe("Filter by color system")
    },
    async ({ system }) => {
      try {
        cache.initialize();

        if (system) {
          const variables = cache.getVariablesByColorSystem(system);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                color_system: system,
                count: variables.length,
                variables: variables.map(v => ({
                  id: v.id,
                  name: v.name,
                  daisyui_name: v.daisyui_name,
                  tailwind_name: v.tailwind_name,
                  tailwind_shade: v.tailwind_shade,
                  hex: v.hex,
                  semantic_role: v.semantic_role,
                  bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
                }))
              }, null, 2)
            }]
          };
        }

        // Get all systems
        const systems = ['daisyui', 'tailwind', 'custom', 'brand'];
        const result: Record<string, any> = {};

        for (const sys of systems) {
          const vars = cache.getVariablesByColorSystem(sys);
          if (vars.length > 0) {
            result[sys] = {
              count: vars.length,
              variables: vars.slice(0, 10).map(v => ({
                id: v.id,
                name: v.name,
                hex: v.hex
              })),
              has_more: vars.length > 10
            };
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              summary: result
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
   * List variables by token type
   */
  server.tool(
    "list_variables_by_token_type",
    "List all variables organized by token type (color, spacing, typography, radius, shadow, opacity, boolean, string).",
    {
      token_type: z.enum(["color", "spacing", "typography", "radius", "shadow", "opacity", "sizing", "boolean", "string"]).optional().describe("Filter by token type")
    },
    async ({ token_type }) => {
      try {
        cache.initialize();

        if (token_type) {
          const variables = cache.getVariablesByTokenType(token_type);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                token_type,
                count: variables.length,
                variables: variables.map(v => ({
                  id: v.id,
                  name: v.name,
                  resolved_type: v.resolved_type,
                  hex: v.hex,
                  color_system: v.color_system,
                  semantic_role: v.semantic_role,
                  tailwind_class: v.tailwind_class
                }))
              }, null, 2)
            }]
          };
        }

        // Get summary by all token types
        const stats = cache.getVariableStats();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_variables: stats.total,
              by_token_type: stats.by_token_type,
              by_resolved_type: stats.by_type
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
   * List variables by semantic role
   */
  server.tool(
    "list_variables_by_semantic_role",
    "List all variables organized by semantic role (background, foreground, border, accent, interactive, state, content).",
    {
      role: z.enum(["background", "foreground", "border", "accent", "interactive", "state", "content"]).optional().describe("Filter by semantic role")
    },
    async ({ role }) => {
      try {
        cache.initialize();

        if (role) {
          const variables = cache.getVariablesBySemanticRole(role);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                semantic_role: role,
                count: variables.length,
                variables: variables.map(v => ({
                  id: v.id,
                  name: v.name,
                  hex: v.hex,
                  color_system: v.color_system,
                  daisyui_name: v.daisyui_name,
                  tailwind_class: v.tailwind_class,
                  bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${v.id}")`
                }))
              }, null, 2)
            }]
          };
        }

        // Get summary by all roles
        const stats = cache.getVariableStats();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_variables: stats.total,
              by_semantic_role: stats.by_semantic_role
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
   * Get variable by Tailwind name
   */
  server.tool(
    "get_cached_variable_by_tailwind",
    "Find a cached variable by its Tailwind color name and shade (e.g., 'blue', '500'). Fast direct lookup.",
    {
      color_name: z.string().describe("Tailwind color name (e.g., 'blue', 'slate', 'emerald')"),
      shade: z.string().optional().describe("Tailwind shade (e.g., '50', '100', '500', '900')")
    },
    async ({ color_name, shade }) => {
      try {
        cache.initialize();

        const variable = cache.getVariableByTailwind(color_name.toLowerCase(), shade);

        if (!variable) {
          // Try fuzzy search
          const searchQuery = shade ? `${color_name} ${shade}` : color_name;
          const results = cache.searchVariables(searchQuery, { colorSystem: 'tailwind', limit: 5 });

          if (results.length > 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  found: false,
                  exact_match: false,
                  suggestions: results.map(r => ({
                    id: r.id,
                    name: r.name,
                    tailwind_name: r.tailwind_name,
                    tailwind_shade: r.tailwind_shade,
                    hex: r.hex
                  }))
                }, null, 2)
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                found: false,
                message: `No variable found for Tailwind ${color_name}${shade ? '-' + shade : ''}`,
                suggestion: "Try building the index with build_index, or search with search_cached_variables"
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              id: variable.id,
              name: variable.name,
              tailwind_name: variable.tailwind_name,
              tailwind_shade: variable.tailwind_shade,
              tailwind_class: variable.tailwind_class,
              hex: variable.hex,
              hsl: variable.hsl,
              bind_command: `mcp__figma__set_fill_variable(nodeId="<node_id>", variableId="${variable.id}")`
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
   * Get detailed variable statistics
   */
  server.tool(
    "get_variable_statistics",
    "Get detailed statistics about all cached variables including counts by type, color system, token type, and semantic role.",
    {},
    async () => {
      try {
        cache.initialize();
        const stats = cache.getVariableStats();
        const generalStats = cache.getStats();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              document_name: cache.getMeta('document_name'),
              total_variables: stats.total,
              total_bindings: stats.bindings_count,
              by_figma_type: stats.by_type,
              by_color_system: stats.by_color_system,
              by_token_type: stats.by_token_type,
              by_semantic_role: stats.by_semantic_role,
              collections: generalStats.collection_count,
              last_synced: generalStats.last_synced
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
   * Get spacing/sizing variables
   */
  server.tool(
    "list_spacing_variables",
    "List all spacing and sizing variables (gaps, padding, margins, widths, heights).",
    {},
    async () => {
      try {
        cache.initialize();
        const variables = cache.getSpacingVariables();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: variables.length,
              variables: variables.map(v => ({
                id: v.id,
                name: v.name,
                token_type: v.token_type,
                resolved_type: v.resolved_type,
                tailwind_class: v.tailwind_class
              }))
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
   * Get variable values by mode (light/dark theme support)
   */
  server.tool(
    "get_variable_mode_values",
    "Get all mode values for a variable (e.g., light mode vs dark mode values). Useful for theme-aware design.",
    {
      variable_id: z.string().describe("The Figma variable ID")
    },
    async ({ variable_id }) => {
      try {
        cache.initialize();
        const modeValues = cache.getVariableModeValues(variable_id);
        const variable = cache.getVariable(variable_id);

        if (!variable) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                found: false,
                message: `Variable not found: ${variable_id}`
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              variable: {
                id: variable.id,
                name: variable.name,
                resolved_type: variable.resolved_type,
                color_system: variable.color_system
              },
              modes: modeValues.map(mv => ({
                mode_id: mv.mode_id,
                mode_name: mv.mode_name,
                hex: mv.hex,
                rgb: mv.rgb,
                hsl: mv.hsl,
                float_value: mv.float_value,
                string_value: mv.string_value,
                boolean_value: mv.boolean_value,
                is_alias: mv.is_alias === 1,
                alias_variable_id: mv.alias_variable_id
              }))
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
