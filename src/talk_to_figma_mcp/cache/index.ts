/**
 * SQLite Cache Manager for Figma Index
 *
 * Provides fast local queries without Figma round-trips.
 * Uses bun:sqlite for native Bun compatibility.
 */

import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// Types
export interface IndexedNode {
  id: number;
  figma_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  page_id: string;
  path: string;
  depth: number;
  component_key: string | null;
  component_name: string | null;
  daisyui_class: string | null;
  daisyui_component: string | null;
  daisyui_variant: string | null;
  daisyui_size: string | null;
  tailwind_classes: string | null;
  data_testid: string | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  content_hash: string | null;
  last_synced: string;
}

export interface IndexedComponent {
  id: number;
  key: string;
  name: string;
  category: string;
  subcategory: string | null;
  figma_id: string | null;
  daisyui_class: string;
  tailwind_base: string | null;
  variants: string | null;
  default_variant: string | null;
  description: string | null;
  usage_hint: string | null;
  example_contexts: string | null;
  clone_ready: boolean;
  usage_count: number;
  last_used: string | null;
  last_synced: string;
}

export interface IndexedPage {
  id: string;
  name: string;
  node_count: number;
  component_count: number;
  frame_count: number;
  summary: string | null;
  main_sections: string | null;
  last_synced: string;
}

export interface SearchResult {
  figma_id: string;
  name: string;
  path: string;
  type: string;
  daisyui_class: string | null;
  daisyui_component: string | null;
  relevance: number;
}

export interface IndexedVariableCollection {
  id: string;
  name: string;
  modes: string | null;  // JSON array of mode objects
  default_mode_id: string | null;
  variable_count: number;
  last_synced: string;
}

export interface IndexedVariable {
  id: string;
  name: string;
  collection_id: string;
  resolved_type: string;  // COLOR, FLOAT, STRING, BOOLEAN
  daisyui_name: string | null;
  daisyui_category: string | null;
  values_by_mode: string | null;  // JSON object
  hex: string | null;
  rgb: string | null;
  description: string | null;
  scopes: string | null;  // JSON array
  last_synced: string;
}

export interface VariableSearchResult {
  id: string;
  name: string;
  collection_id: string;
  resolved_type: string;
  daisyui_name: string | null;
  hex: string | null;
  relevance: number;
}

class CacheManager {
  private db: Database | null = null;
  private dbPath: string;
  private migrationsPath: string;
  private cacheDir: string;
  private currentDocumentId: string | null = null;

  constructor() {
    // Get the directory where this module is located (works with Bun ESM)
    // This ensures migrations are found relative to the package, not cwd
    // Structure: dist/talk_to_figma_mcp/server.js -> import.meta.dir = dist/talk_to_figma_mcp
    // So we go up 2 levels to reach the package root
    const moduleDir = import.meta.dir;
    const packageRoot = path.resolve(moduleDir, '../..');

    // Default paths - can be overridden via environment
    this.cacheDir = process.env.FIGMA_CACHE_DIR || path.join(packageRoot, 'cache');
    // Default database path (used when no document ID is set)
    this.dbPath = process.env.FIGMA_INDEX_PATH || path.join(this.cacheDir, 'figma-index.db');
    // Migrations are in the package root
    this.migrationsPath = path.join(packageRoot, 'migrations');
  }

  /**
   * Set the current document ID and switch to its database
   * Each Figma document gets its own SQLite database file
   */
  setDocumentId(documentId: string): void {
    if (this.currentDocumentId === documentId && this.db) {
      return; // Already using this document's database
    }

    // Close existing connection if switching documents
    if (this.db && this.currentDocumentId !== documentId) {
      this.close();
    }

    this.currentDocumentId = documentId;
    // Sanitize document ID for filesystem (Figma IDs can contain special chars)
    const safeId = documentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.dbPath = path.join(this.cacheDir, `figma-index-${safeId}.db`);
    logger.info(`Switched to database for document: ${documentId} (${this.dbPath})`);
  }

  /**
   * Get the current document ID
   */
  getDocumentId(): string | null {
    return this.currentDocumentId;
  }

  /**
   * List all cached document databases
   */
  listCachedDocuments(): { documentId: string; dbPath: string; size: number; lastModified: Date }[] {
    if (!fs.existsSync(this.cacheDir)) {
      return [];
    }

    const files = fs.readdirSync(this.cacheDir);
    const results: { documentId: string; dbPath: string; size: number; lastModified: Date }[] = [];

    for (const file of files) {
      if (file.startsWith('figma-index-') && file.endsWith('.db')) {
        const fullPath = path.join(this.cacheDir, file);
        const stats = fs.statSync(fullPath);
        // Extract document ID from filename
        const docId = file.replace('figma-index-', '').replace('.db', '');
        results.push({
          documentId: docId,
          dbPath: fullPath,
          size: stats.size,
          lastModified: stats.mtime
        });
      }
    }

    return results;
  }

  /**
   * Initialize the database connection and run migrations
   */
  initialize(): void {
    if (this.db) return;

    // Ensure cache directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');

    // Run migrations
    this.runMigrations();

    logger.info(`Cache database initialized at ${this.dbPath}`);
  }

  /**
   * Run SQL migrations
   */
  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    const migrationFile = path.join(this.migrationsPath, '001_initial.sql');

    if (fs.existsSync(migrationFile)) {
      const sql = fs.readFileSync(migrationFile, 'utf-8');
      this.db.exec(sql);
      logger.info('Migrations applied successfully');
    } else {
      logger.warn(`Migration file not found: ${migrationFile}`);
    }
  }

  /**
   * Get database instance (initialize if needed)
   */
  getDb(): Database {
    if (!this.db) {
      this.initialize();
    }
    return this.db!;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================================
  // NODE OPERATIONS
  // ============================================================

  /**
   * Upsert a node into the index
   */
  upsertNode(node: Omit<IndexedNode, 'id' | 'last_synced'>): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO nodes (
        figma_id, name, type, parent_id, page_id, path, depth,
        component_key, component_name,
        daisyui_class, daisyui_component, daisyui_variant, daisyui_size,
        tailwind_classes, data_testid,
        x, y, width, height, content_hash
      ) VALUES (
        $figma_id, $name, $type, $parent_id, $page_id, $path, $depth,
        $component_key, $component_name,
        $daisyui_class, $daisyui_component, $daisyui_variant, $daisyui_size,
        $tailwind_classes, $data_testid,
        $x, $y, $width, $height, $content_hash
      )
      ON CONFLICT(figma_id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        parent_id = excluded.parent_id,
        page_id = excluded.page_id,
        path = excluded.path,
        depth = excluded.depth,
        component_key = excluded.component_key,
        component_name = excluded.component_name,
        daisyui_class = excluded.daisyui_class,
        daisyui_component = excluded.daisyui_component,
        daisyui_variant = excluded.daisyui_variant,
        daisyui_size = excluded.daisyui_size,
        tailwind_classes = excluded.tailwind_classes,
        data_testid = excluded.data_testid,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        content_hash = excluded.content_hash,
        last_synced = CURRENT_TIMESTAMP
    `);

    stmt.run({
      $figma_id: node.figma_id,
      $name: node.name,
      $type: node.type,
      $parent_id: node.parent_id,
      $page_id: node.page_id,
      $path: node.path,
      $depth: node.depth,
      $component_key: node.component_key,
      $component_name: node.component_name,
      $daisyui_class: node.daisyui_class,
      $daisyui_component: node.daisyui_component,
      $daisyui_variant: node.daisyui_variant,
      $daisyui_size: node.daisyui_size,
      $tailwind_classes: node.tailwind_classes,
      $data_testid: node.data_testid,
      $x: node.x,
      $y: node.y,
      $width: node.width,
      $height: node.height,
      $content_hash: node.content_hash,
    });
  }

  /**
   * Bulk insert nodes (much faster than individual inserts)
   */
  bulkUpsertNodes(nodes: Omit<IndexedNode, 'id' | 'last_synced'>[]): number {
    const db = this.getDb();

    const stmt = db.prepare(`
      INSERT INTO nodes (
        figma_id, name, type, parent_id, page_id, path, depth,
        component_key, component_name,
        daisyui_class, daisyui_component, daisyui_variant, daisyui_size,
        tailwind_classes, data_testid,
        x, y, width, height, content_hash
      ) VALUES (
        $figma_id, $name, $type, $parent_id, $page_id, $path, $depth,
        $component_key, $component_name,
        $daisyui_class, $daisyui_component, $daisyui_variant, $daisyui_size,
        $tailwind_classes, $data_testid,
        $x, $y, $width, $height, $content_hash
      )
      ON CONFLICT(figma_id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        parent_id = excluded.parent_id,
        page_id = excluded.page_id,
        path = excluded.path,
        depth = excluded.depth,
        component_key = excluded.component_key,
        component_name = excluded.component_name,
        daisyui_class = excluded.daisyui_class,
        daisyui_component = excluded.daisyui_component,
        daisyui_variant = excluded.daisyui_variant,
        daisyui_size = excluded.daisyui_size,
        tailwind_classes = excluded.tailwind_classes,
        data_testid = excluded.data_testid,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        content_hash = excluded.content_hash,
        last_synced = CURRENT_TIMESTAMP
    `);

    // Use bun:sqlite's transaction API
    const insertMany = db.transaction(() => {
      for (const node of nodes) {
        stmt.run({
          $figma_id: node.figma_id,
          $name: node.name,
          $type: node.type,
          $parent_id: node.parent_id,
          $page_id: node.page_id,
          $path: node.path,
          $depth: node.depth,
          $component_key: node.component_key,
          $component_name: node.component_name,
          $daisyui_class: node.daisyui_class,
          $daisyui_component: node.daisyui_component,
          $daisyui_variant: node.daisyui_variant,
          $daisyui_size: node.daisyui_size,
          $tailwind_classes: node.tailwind_classes,
          $data_testid: node.data_testid,
          $x: node.x,
          $y: node.y,
          $width: node.width,
          $height: node.height,
          $content_hash: node.content_hash,
        });
      }
      return nodes.length;
    });

    return insertMany();
  }

  /**
   * Get node by Figma ID
   */
  getNode(figmaId: string): IndexedNode | undefined {
    const db = this.getDb();
    return db.prepare('SELECT * FROM nodes WHERE figma_id = ?').get(figmaId) as IndexedNode | undefined;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: string, pageId?: string, limit = 100): IndexedNode[] {
    const db = this.getDb();

    if (pageId) {
      return db.prepare(`
        SELECT * FROM nodes WHERE type = ? AND page_id = ? LIMIT ?
      `).all(type, pageId, limit) as IndexedNode[];
    }

    return db.prepare(`
      SELECT * FROM nodes WHERE type = ? LIMIT ?
    `).all(type, limit) as IndexedNode[];
  }

  /**
   * Get nodes by DaisyUI component type
   */
  getNodesByDaisyUI(component: string, limit = 50): IndexedNode[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM nodes WHERE daisyui_component = ? LIMIT ?
    `).all(component, limit) as IndexedNode[];
  }

  /**
   * Get all nodes (for bulk operations like token extraction)
   */
  getAllNodes(limit = 10000): IndexedNode[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM nodes ORDER BY depth ASC LIMIT ?
    `).all(limit) as IndexedNode[];
  }

  // ============================================================
  // SEARCH OPERATIONS
  // ============================================================

  /**
   * Full-text search across nodes
   */
  searchNodes(query: string, options?: {
    type?: string;
    category?: string;
    pageId?: string;
    limit?: number;
  }): SearchResult[] {
    const db = this.getDb();
    const limit = options?.limit || 20;

    // Build FTS query (escape special chars)
    const ftsQuery = query.replace(/['"]/g, '').split(/\s+/).map(t => `"${t}"*`).join(' OR ');

    let sql = `
      SELECT
        n.figma_id,
        n.name,
        n.path,
        n.type,
        n.daisyui_class,
        n.daisyui_component,
        bm25(nodes_fts) as relevance
      FROM nodes_fts
      JOIN nodes n ON nodes_fts.rowid = n.id
      WHERE nodes_fts MATCH ?
    `;

    const params: any[] = [ftsQuery];

    if (options?.type) {
      sql += ' AND n.type = ?';
      params.push(options.type);
    }

    if (options?.pageId) {
      sql += ' AND n.page_id = ?';
      params.push(options.pageId);
    }

    sql += ' ORDER BY relevance LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params) as SearchResult[];
  }

  /**
   * Search components by name/category
   */
  searchComponents(query: string, category?: string, limit = 20): IndexedComponent[] {
    const db = this.getDb();
    const ftsQuery = query.replace(/['"]/g, '').split(/\s+/).map(t => `"${t}"*`).join(' OR ');

    let sql = `
      SELECT c.*
      FROM components_fts
      JOIN components c ON components_fts.rowid = c.id
      WHERE components_fts MATCH ?
    `;

    const params: any[] = [ftsQuery];

    if (category) {
      sql += ' AND c.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY c.usage_count DESC LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params) as IndexedComponent[];
  }

  /**
   * Find component by DaisyUI class
   */
  getComponentByClass(daisyuiClass: string): IndexedComponent | undefined {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM components WHERE daisyui_class = ?
    `).get(daisyuiClass) as IndexedComponent | undefined;
  }

  // ============================================================
  // PAGE OPERATIONS
  // ============================================================

  /**
   * Upsert a page
   */
  upsertPage(page: Omit<IndexedPage, 'last_synced'>): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO pages (id, name, node_count, component_count, frame_count, summary, main_sections)
      VALUES ($id, $name, $node_count, $component_count, $frame_count, $summary, $main_sections)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        node_count = excluded.node_count,
        component_count = excluded.component_count,
        frame_count = excluded.frame_count,
        summary = excluded.summary,
        main_sections = excluded.main_sections,
        last_synced = CURRENT_TIMESTAMP
    `).run({
      $id: page.id,
      $name: page.name,
      $node_count: page.node_count,
      $component_count: page.component_count,
      $frame_count: page.frame_count,
      $summary: page.summary,
      $main_sections: page.main_sections,
    });
  }

  /**
   * Get all pages
   */
  getPages(): IndexedPage[] {
    const db = this.getDb();
    return db.prepare('SELECT * FROM pages ORDER BY name').all() as IndexedPage[];
  }

  /**
   * Get page by ID
   */
  getPage(id: string): IndexedPage | undefined {
    const db = this.getDb();
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as IndexedPage | undefined;
  }

  // ============================================================
  // COMPONENT OPERATIONS
  // ============================================================

  /**
   * Upsert a component
   */
  upsertComponent(component: Omit<IndexedComponent, 'id' | 'usage_count' | 'last_used' | 'last_synced'>): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO components (
        key, name, category, subcategory, figma_id,
        daisyui_class, tailwind_base, variants, default_variant,
        description, usage_hint, example_contexts, clone_ready
      ) VALUES (
        $key, $name, $category, $subcategory, $figma_id,
        $daisyui_class, $tailwind_base, $variants, $default_variant,
        $description, $usage_hint, $example_contexts, $clone_ready
      )
      ON CONFLICT(key) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        subcategory = excluded.subcategory,
        figma_id = excluded.figma_id,
        daisyui_class = excluded.daisyui_class,
        tailwind_base = excluded.tailwind_base,
        variants = excluded.variants,
        default_variant = excluded.default_variant,
        description = excluded.description,
        usage_hint = excluded.usage_hint,
        example_contexts = excluded.example_contexts,
        clone_ready = excluded.clone_ready,
        last_synced = CURRENT_TIMESTAMP
    `).run({
      $key: component.key,
      $name: component.name,
      $category: component.category,
      $subcategory: component.subcategory,
      $figma_id: component.figma_id,
      $daisyui_class: component.daisyui_class,
      $tailwind_base: component.tailwind_base,
      $variants: component.variants,
      $default_variant: component.default_variant,
      $description: component.description,
      $usage_hint: component.usage_hint,
      $example_contexts: component.example_contexts,
      $clone_ready: component.clone_ready ? 1 : 0,
    });
  }

  /**
   * Get components by category
   */
  getComponentsByCategory(category: string): IndexedComponent[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM components WHERE category = ? ORDER BY usage_count DESC
    `).all(category) as IndexedComponent[];
  }

  /**
   * Increment component usage count
   */
  incrementComponentUsage(key: string): void {
    const db = this.getDb();
    db.prepare(`
      UPDATE components
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
      WHERE key = ?
    `).run(key);
  }

  // ============================================================
  // VARIABLE COLLECTION OPERATIONS
  // ============================================================

  /**
   * Upsert a variable collection
   */
  upsertVariableCollection(collection: Omit<IndexedVariableCollection, 'last_synced'>): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO variable_collections (id, name, modes, default_mode_id, variable_count)
      VALUES ($id, $name, $modes, $default_mode_id, $variable_count)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        modes = excluded.modes,
        default_mode_id = excluded.default_mode_id,
        variable_count = excluded.variable_count,
        last_synced = CURRENT_TIMESTAMP
    `).run({
      $id: collection.id,
      $name: collection.name,
      $modes: collection.modes,
      $default_mode_id: collection.default_mode_id,
      $variable_count: collection.variable_count,
    });
  }

  /**
   * Get all variable collections
   */
  getVariableCollections(): IndexedVariableCollection[] {
    const db = this.getDb();
    return db.prepare('SELECT * FROM variable_collections ORDER BY name').all() as IndexedVariableCollection[];
  }

  /**
   * Get collection by ID
   */
  getVariableCollection(id: string): IndexedVariableCollection | undefined {
    const db = this.getDb();
    return db.prepare('SELECT * FROM variable_collections WHERE id = ?').get(id) as IndexedVariableCollection | undefined;
  }

  // ============================================================
  // VARIABLE OPERATIONS
  // ============================================================

  /**
   * Upsert a variable
   */
  upsertVariable(variable: Omit<IndexedVariable, 'last_synced'>): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO variables (
        id, name, collection_id, resolved_type,
        daisyui_name, daisyui_category, values_by_mode,
        hex, rgb, description, scopes
      ) VALUES (
        $id, $name, $collection_id, $resolved_type,
        $daisyui_name, $daisyui_category, $values_by_mode,
        $hex, $rgb, $description, $scopes
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        collection_id = excluded.collection_id,
        resolved_type = excluded.resolved_type,
        daisyui_name = excluded.daisyui_name,
        daisyui_category = excluded.daisyui_category,
        values_by_mode = excluded.values_by_mode,
        hex = excluded.hex,
        rgb = excluded.rgb,
        description = excluded.description,
        scopes = excluded.scopes,
        last_synced = CURRENT_TIMESTAMP
    `).run({
      $id: variable.id,
      $name: variable.name,
      $collection_id: variable.collection_id,
      $resolved_type: variable.resolved_type,
      $daisyui_name: variable.daisyui_name,
      $daisyui_category: variable.daisyui_category,
      $values_by_mode: variable.values_by_mode,
      $hex: variable.hex,
      $rgb: variable.rgb,
      $description: variable.description,
      $scopes: variable.scopes,
    });
  }

  /**
   * Bulk insert variables (faster than individual inserts)
   */
  bulkUpsertVariables(variables: Omit<IndexedVariable, 'last_synced'>[]): number {
    const db = this.getDb();

    const stmt = db.prepare(`
      INSERT INTO variables (
        id, name, collection_id, resolved_type,
        daisyui_name, daisyui_category, values_by_mode,
        hex, rgb, description, scopes
      ) VALUES (
        $id, $name, $collection_id, $resolved_type,
        $daisyui_name, $daisyui_category, $values_by_mode,
        $hex, $rgb, $description, $scopes
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        collection_id = excluded.collection_id,
        resolved_type = excluded.resolved_type,
        daisyui_name = excluded.daisyui_name,
        daisyui_category = excluded.daisyui_category,
        values_by_mode = excluded.values_by_mode,
        hex = excluded.hex,
        rgb = excluded.rgb,
        description = excluded.description,
        scopes = excluded.scopes,
        last_synced = CURRENT_TIMESTAMP
    `);

    const insertMany = db.transaction(() => {
      for (const variable of variables) {
        stmt.run({
          $id: variable.id,
          $name: variable.name,
          $collection_id: variable.collection_id,
          $resolved_type: variable.resolved_type,
          $daisyui_name: variable.daisyui_name,
          $daisyui_category: variable.daisyui_category,
          $values_by_mode: variable.values_by_mode,
          $hex: variable.hex,
          $rgb: variable.rgb,
          $description: variable.description,
          $scopes: variable.scopes,
        });
      }
      return variables.length;
    });

    return insertMany();
  }

  /**
   * Get variable by ID
   */
  getVariable(id: string): IndexedVariable | undefined {
    const db = this.getDb();
    return db.prepare('SELECT * FROM variables WHERE id = ?').get(id) as IndexedVariable | undefined;
  }

  /**
   * Get variables by collection
   */
  getVariablesByCollection(collectionId: string): IndexedVariable[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM variables WHERE collection_id = ? ORDER BY name
    `).all(collectionId) as IndexedVariable[];
  }

  /**
   * Get variables by type (COLOR, FLOAT, STRING, BOOLEAN)
   */
  getVariablesByType(resolvedType: string): IndexedVariable[] {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM variables WHERE resolved_type = ? ORDER BY name
    `).all(resolvedType) as IndexedVariable[];
  }

  /**
   * Get all color variables
   */
  getColorVariables(): IndexedVariable[] {
    return this.getVariablesByType('COLOR');
  }

  /**
   * Get variable by DaisyUI name (e.g., 'primary', 'base-100')
   */
  getVariableByDaisyUIName(daisyuiName: string): IndexedVariable | undefined {
    const db = this.getDb();
    return db.prepare(`
      SELECT * FROM variables WHERE daisyui_name = ?
    `).get(daisyuiName) as IndexedVariable | undefined;
  }

  /**
   * Search variables by name or DaisyUI mapping
   */
  searchVariables(query: string, options?: {
    type?: string;
    collectionId?: string;
    limit?: number;
  }): VariableSearchResult[] {
    const db = this.getDb();
    const limit = options?.limit || 20;

    // Build FTS query
    const ftsQuery = query.replace(/['"]/g, '').split(/\s+/).map(t => `"${t}"*`).join(' OR ');

    let sql = `
      SELECT
        v.id,
        v.name,
        v.collection_id,
        v.resolved_type,
        v.daisyui_name,
        v.hex,
        bm25(variables_fts) as relevance
      FROM variables_fts
      JOIN variables v ON variables_fts.rowid = v.rowid
      WHERE variables_fts MATCH ?
    `;

    const params: any[] = [ftsQuery];

    if (options?.type) {
      sql += ' AND v.resolved_type = ?';
      params.push(options.type);
    }

    if (options?.collectionId) {
      sql += ' AND v.collection_id = ?';
      params.push(options.collectionId);
    }

    sql += ' ORDER BY relevance LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params) as VariableSearchResult[];
  }

  /**
   * Get all variables
   */
  getAllVariables(): IndexedVariable[] {
    const db = this.getDb();
    return db.prepare('SELECT * FROM variables ORDER BY name').all() as IndexedVariable[];
  }

  // ============================================================
  // METADATA OPERATIONS
  // ============================================================

  /**
   * Get sync metadata value
   */
  getMeta(key: string): string | undefined {
    const db = this.getDb();
    const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  /**
   * Set sync metadata value
   */
  setMeta(key: string, value: string): void {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO sync_meta (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, value);
  }

  /**
   * Get index statistics
   */
  getStats(): {
    node_count: number;
    component_count: number;
    page_count: number;
    variable_count: number;
    collection_count: number;
    last_synced: string | undefined;
  } {
    const db = this.getDb();

    const nodeCount = (db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }).count;
    const componentCount = (db.prepare('SELECT COUNT(*) as count FROM components').get() as { count: number }).count;
    const pageCount = (db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number }).count;
    const variableCount = (db.prepare('SELECT COUNT(*) as count FROM variables').get() as { count: number }).count;
    const collectionCount = (db.prepare('SELECT COUNT(*) as count FROM variable_collections').get() as { count: number }).count;
    const lastSynced = this.getMeta('last_full_sync');

    return {
      node_count: nodeCount,
      component_count: componentCount,
      page_count: pageCount,
      variable_count: variableCount,
      collection_count: collectionCount,
      last_synced: lastSynced
    };
  }

  /**
   * Clear all data (for rebuild)
   */
  clearAll(): void {
    const db = this.getDb();
    db.exec(`
      DELETE FROM nodes;
      DELETE FROM components;
      DELETE FROM pages;
      DELETE FROM design_tokens;
      DELETE FROM variables;
      DELETE FROM variable_collections;
    `);
    this.setMeta('last_full_sync', '');
  }
}

// Singleton instance
export const cache = new CacheManager();
export default cache;
