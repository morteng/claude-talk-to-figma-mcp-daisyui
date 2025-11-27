-- ============================================================
-- Claude Talk to Figma MCP - DaisyUI Edition
-- SQLite Schema v1.0
-- ============================================================

-- Nodes index - fast lookups without Figma round-trips
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    figma_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- FRAME, COMPONENT, INSTANCE, TEXT, GROUP, etc.
    parent_id TEXT,
    page_id TEXT NOT NULL,

    -- Hierarchical path for human-readable queries
    path TEXT,           -- "Dashboard/Stats Section/Power Card"
    depth INTEGER DEFAULT 0,

    -- Component reference (for instances)
    component_key TEXT,
    component_name TEXT,

    -- Pre-computed DaisyUI mapping (the key feature!)
    daisyui_class TEXT,        -- "btn btn-primary"
    daisyui_component TEXT,    -- "button"
    daisyui_variant TEXT,      -- "primary"
    daisyui_size TEXT,         -- "md"

    -- Tailwind extraction
    tailwind_classes TEXT,     -- JSON array: ["flex", "gap-4"]

    -- Testing support
    data_testid TEXT,          -- Auto-generated from path

    -- Layout info (for understanding structure)
    x REAL,
    y REAL,
    width REAL,
    height REAL,

    -- Change detection
    content_hash TEXT,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (page_id) REFERENCES pages(id)
);

-- Components library (DaisyUI design kit)
CREATE TABLE IF NOT EXISTS components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,     -- buttons, forms, cards, navigation, etc.
    subcategory TEXT,           -- primary, secondary, ghost (for buttons)

    -- Node reference
    figma_id TEXT,

    -- DaisyUI mapping
    daisyui_class TEXT NOT NULL,
    tailwind_base TEXT,         -- Base Tailwind classes

    -- Variant properties
    variants TEXT,              -- JSON: {"size": ["xs","sm","md","lg"]}
    default_variant TEXT,       -- JSON: {"size": "md"}

    -- Usage hints for agent (really helpful!)
    description TEXT,
    usage_hint TEXT,            -- "Use for primary actions like Submit, Save"
    example_contexts TEXT,      -- JSON array of good use cases

    -- Clone info
    clone_ready BOOLEAN DEFAULT 1,

    -- Statistics
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP,

    -- Sync tracking
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pages overview
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    node_count INTEGER DEFAULT 0,
    component_count INTEGER DEFAULT 0,
    frame_count INTEGER DEFAULT 0,

    -- Quick summary for agent
    summary TEXT,               -- Auto-generated page description
    main_sections TEXT,         -- JSON array of top-level frame names

    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Design tokens (extracted from Figma styles)
CREATE TABLE IF NOT EXISTS design_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,     -- color, spacing, typography, shadow
    figma_style_id TEXT,

    -- Values
    value TEXT NOT NULL,        -- Raw value
    daisyui_var TEXT,          -- CSS variable: "--p"
    tailwind_class TEXT,       -- Direct Tailwind class if applicable

    -- Color-specific
    hex TEXT,
    rgb TEXT,
    hsl TEXT,

    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Full-Text Search (FTS5) for natural language queries
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    path,
    daisyui_class,
    daisyui_component,
    data_testid,
    content=nodes,
    content_rowid=id
);

CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
    name,
    category,
    subcategory,
    daisyui_class,
    description,
    usage_hint,
    content=components,
    content_rowid=id
);

-- ============================================================
-- Indexes for fast queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_page ON nodes(page_id);
CREATE INDEX IF NOT EXISTS idx_nodes_daisyui ON nodes(daisyui_class);
CREATE INDEX IF NOT EXISTS idx_nodes_daisyui_component ON nodes(daisyui_component);
CREATE INDEX IF NOT EXISTS idx_nodes_component_key ON nodes(component_key);
CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path);

CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
CREATE INDEX IF NOT EXISTS idx_components_daisyui ON components(daisyui_class);
CREATE INDEX IF NOT EXISTS idx_components_key ON components(key);

CREATE INDEX IF NOT EXISTS idx_tokens_category ON design_tokens(category);
CREATE INDEX IF NOT EXISTS idx_tokens_daisyui ON design_tokens(daisyui_var);

-- ============================================================
-- Triggers to keep FTS in sync
-- ============================================================

CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(rowid, name, path, daisyui_class, daisyui_component, data_testid)
  VALUES (new.id, new.name, new.path, new.daisyui_class, new.daisyui_component, new.data_testid);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, path, daisyui_class, daisyui_component, data_testid)
  VALUES ('delete', old.id, old.name, old.path, old.daisyui_class, old.daisyui_component, old.data_testid);
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, path, daisyui_class, daisyui_component, data_testid)
  VALUES ('delete', old.id, old.name, old.path, old.daisyui_class, old.daisyui_component, old.data_testid);
  INSERT INTO nodes_fts(rowid, name, path, daisyui_class, daisyui_component, data_testid)
  VALUES (new.id, new.name, new.path, new.daisyui_class, new.daisyui_component, new.data_testid);
END;

CREATE TRIGGER IF NOT EXISTS components_ai AFTER INSERT ON components BEGIN
  INSERT INTO components_fts(rowid, name, category, subcategory, daisyui_class, description, usage_hint)
  VALUES (new.id, new.name, new.category, new.subcategory, new.daisyui_class, new.description, new.usage_hint);
END;

CREATE TRIGGER IF NOT EXISTS components_ad AFTER DELETE ON components BEGIN
  INSERT INTO components_fts(components_fts, rowid, name, category, subcategory, daisyui_class, description, usage_hint)
  VALUES ('delete', old.id, old.name, old.category, old.subcategory, old.daisyui_class, old.description, old.usage_hint);
END;

CREATE TRIGGER IF NOT EXISTS components_au AFTER UPDATE ON components BEGIN
  INSERT INTO components_fts(components_fts, rowid, name, category, subcategory, daisyui_class, description, usage_hint)
  VALUES ('delete', old.id, old.name, old.category, old.subcategory, old.daisyui_class, old.description, old.usage_hint);
  INSERT INTO components_fts(rowid, name, category, subcategory, daisyui_class, description, usage_hint)
  VALUES (new.id, new.name, new.category, new.subcategory, new.daisyui_class, new.description, new.usage_hint);
END;

-- ============================================================
-- Initial metadata
-- ============================================================

INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('schema_version', '1.0');
INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('created_at', datetime('now'));
