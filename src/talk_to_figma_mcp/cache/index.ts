/**
 * SQLite Cache Manager for Figma Index
 *
 * Provides fast local queries without Figma round-trips.
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 */

import Database from 'better-sqlite3';
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

class CacheManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private migrationsPath: string;

  constructor() {
    // Default paths - can be overridden via environment
    const cacheDir = process.env.FIGMA_CACHE_DIR || path.join(process.cwd(), 'cache');
    this.dbPath = process.env.FIGMA_INDEX_PATH || path.join(cacheDir, 'figma-index.db');
    this.migrationsPath = path.join(__dirname, '../../../migrations');
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
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

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
  getDb(): Database.Database {
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
        @figma_id, @name, @type, @parent_id, @page_id, @path, @depth,
        @component_key, @component_name,
        @daisyui_class, @daisyui_component, @daisyui_variant, @daisyui_size,
        @tailwind_classes, @data_testid,
        @x, @y, @width, @height, @content_hash
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

    stmt.run(node);
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
        @figma_id, @name, @type, @parent_id, @page_id, @path, @depth,
        @component_key, @component_name,
        @daisyui_class, @daisyui_component, @daisyui_variant, @daisyui_size,
        @tailwind_classes, @data_testid,
        @x, @y, @width, @height, @content_hash
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

    const insertMany = db.transaction((nodes) => {
      for (const node of nodes) {
        stmt.run(node);
      }
      return nodes.length;
    });

    return insertMany(nodes);
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
      VALUES (@id, @name, @node_count, @component_count, @frame_count, @summary, @main_sections)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        node_count = excluded.node_count,
        component_count = excluded.component_count,
        frame_count = excluded.frame_count,
        summary = excluded.summary,
        main_sections = excluded.main_sections,
        last_synced = CURRENT_TIMESTAMP
    `).run(page);
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
        @key, @name, @category, @subcategory, @figma_id,
        @daisyui_class, @tailwind_base, @variants, @default_variant,
        @description, @usage_hint, @example_contexts, @clone_ready
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
    `).run(component);
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
    last_synced: string | undefined;
  } {
    const db = this.getDb();

    const nodeCount = (db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }).count;
    const componentCount = (db.prepare('SELECT COUNT(*) as count FROM components').get() as { count: number }).count;
    const pageCount = (db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number }).count;
    const lastSynced = this.getMeta('last_full_sync');

    return {
      node_count: nodeCount,
      component_count: componentCount,
      page_count: pageCount,
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
    `);
    this.setMeta('last_full_sync', '');
  }
}

// Singleton instance
export const cache = new CacheManager();
export default cache;
