-- ============================================================
-- Claude Talk to Figma MCP - DaisyUI Edition
-- Migration 002: Enhanced Variable System
-- ============================================================
-- Supports:
-- - All Figma variable types (COLOR, FLOAT, STRING, BOOLEAN)
-- - DaisyUI semantic colors (primary, secondary, accent, etc.)
-- - Tailwind color palette (slate-500, blue-600, etc.)
-- - Spacing tokens (gap, padding, margin)
-- - Typography tokens (font sizes, weights, line heights)
-- - Border radius tokens
-- - Shadow/elevation tokens
-- - Opacity tokens
-- - Boolean feature flags
-- - String tokens (font families, etc.)
-- ============================================================

-- Add new columns to existing variables table
ALTER TABLE variables ADD COLUMN tailwind_name TEXT;        -- e.g., 'slate', 'blue', 'emerald'
ALTER TABLE variables ADD COLUMN tailwind_shade TEXT;       -- e.g., '50', '100', '500', '900'
ALTER TABLE variables ADD COLUMN color_system TEXT;         -- 'daisyui', 'tailwind', 'custom', 'brand'
ALTER TABLE variables ADD COLUMN semantic_role TEXT;        -- 'background', 'foreground', 'border', 'accent', 'interactive'
ALTER TABLE variables ADD COLUMN token_type TEXT;           -- 'color', 'spacing', 'typography', 'radius', 'shadow', 'opacity', 'boolean', 'string'
ALTER TABLE variables ADD COLUMN css_variable TEXT;         -- CSS var name: '--color-primary', '--spacing-4'
ALTER TABLE variables ADD COLUMN tailwind_class TEXT;       -- Direct Tailwind class: 'bg-primary', 'p-4', 'rounded-lg'
ALTER TABLE variables ADD COLUMN is_alias INTEGER DEFAULT 0; -- 1 if this variable references another variable
ALTER TABLE variables ADD COLUMN alias_target_id TEXT;      -- ID of the variable this aliases (if is_alias = 1)
ALTER TABLE variables ADD COLUMN hsl TEXT;                  -- HSL color value for better manipulation
ALTER TABLE variables ADD COLUMN oklch TEXT;                -- OKLCH color value (modern color space)
ALTER TABLE variables ADD COLUMN contrast_ratio REAL;       -- WCAG contrast ratio against base (for content colors)
ALTER TABLE variables ADD COLUMN usage_count INTEGER DEFAULT 0;  -- How many nodes use this variable
ALTER TABLE variables ADD COLUMN is_deprecated INTEGER DEFAULT 0; -- Mark variables as deprecated

-- ============================================================
-- Variable Bindings: Track which variables are bound to which nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS variable_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,              -- Figma node ID
    variable_id TEXT NOT NULL,          -- Figma variable ID
    property TEXT NOT NULL,             -- Property bound: 'fills', 'strokes', 'width', 'height', 'gap', 'padding', 'cornerRadius', 'opacity', 'effects'
    property_index INTEGER DEFAULT 0,   -- Index for multi-value properties (e.g., fills[0], fills[1])
    field TEXT,                         -- Specific field within property: 'color', 'x', 'y', 'blur', 'spread'
    bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(node_id, property, property_index, field),
    FOREIGN KEY (variable_id) REFERENCES variables(id) ON DELETE CASCADE
);

-- ============================================================
-- Variable Aliases: Track variable-to-variable references
-- ============================================================
CREATE TABLE IF NOT EXISTS variable_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_variable_id TEXT NOT NULL,   -- The alias variable
    target_variable_id TEXT NOT NULL,   -- The variable being aliased
    mode_id TEXT,                        -- Mode where this alias applies (NULL = all modes)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(source_variable_id, target_variable_id, mode_id),
    FOREIGN KEY (source_variable_id) REFERENCES variables(id) ON DELETE CASCADE,
    FOREIGN KEY (target_variable_id) REFERENCES variables(id) ON DELETE CASCADE
);

-- ============================================================
-- Variable Values by Mode: Normalized storage for multi-mode values
-- ============================================================
CREATE TABLE IF NOT EXISTS variable_mode_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variable_id TEXT NOT NULL,
    mode_id TEXT NOT NULL,
    mode_name TEXT,                      -- Human-readable: 'Light', 'Dark', 'High Contrast'
    raw_value TEXT NOT NULL,             -- JSON-encoded raw value from Figma

    -- For COLOR type - resolved values
    hex TEXT,
    rgb TEXT,
    hsl TEXT,
    oklch TEXT,

    -- For FLOAT type
    float_value REAL,

    -- For STRING type
    string_value TEXT,

    -- For BOOLEAN type
    boolean_value INTEGER,

    -- Reference tracking (if value is a variable alias)
    is_alias INTEGER DEFAULT 0,
    alias_variable_id TEXT,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(variable_id, mode_id),
    FOREIGN KEY (variable_id) REFERENCES variables(id) ON DELETE CASCADE
);

-- ============================================================
-- Tailwind Color Reference Table
-- Pre-populated with Tailwind's color palette for matching
-- ============================================================
CREATE TABLE IF NOT EXISTS tailwind_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                  -- 'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', etc.
    shade TEXT NOT NULL,                 -- '50', '100', '200', ..., '950'
    hex TEXT NOT NULL,
    rgb TEXT,
    hsl TEXT,
    oklch TEXT,
    is_default INTEGER DEFAULT 0,        -- 1 for the "default" shade (usually 500)

    UNIQUE(name, shade)
);

-- ============================================================
-- DaisyUI Semantic Color Reference Table
-- Pre-populated with DaisyUI's semantic colors
-- ============================================================
CREATE TABLE IF NOT EXISTS daisyui_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,           -- 'primary', 'secondary', 'accent', 'neutral', etc.
    css_variable TEXT NOT NULL,          -- '--p', '--s', '--a', '--n', etc.
    category TEXT NOT NULL,              -- 'brand', 'base', 'state', 'content'
    description TEXT,
    default_hex TEXT,                    -- Default value from DaisyUI
    pairs_with TEXT,                     -- JSON array of colors this pairs with
    usage_hint TEXT                      -- When to use this color
);

-- ============================================================
-- Design Token Categories (for organizing variables)
-- ============================================================
CREATE TABLE IF NOT EXISTS token_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,           -- 'colors', 'spacing', 'typography', 'effects'
    display_name TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT OR IGNORE INTO token_categories (name, display_name, description, sort_order) VALUES
    ('colors', 'Colors', 'Color tokens including brand, semantic, and palette colors', 1),
    ('spacing', 'Spacing', 'Spacing tokens for margins, padding, and gaps', 2),
    ('typography', 'Typography', 'Font sizes, weights, line heights, and letter spacing', 3),
    ('radius', 'Border Radius', 'Corner radius tokens', 4),
    ('shadows', 'Shadows', 'Box shadow and drop shadow tokens', 5),
    ('opacity', 'Opacity', 'Opacity/alpha tokens', 6),
    ('sizing', 'Sizing', 'Width, height, and other size tokens', 7),
    ('breakpoints', 'Breakpoints', 'Responsive breakpoint tokens', 8),
    ('motion', 'Motion', 'Animation duration and easing tokens', 9),
    ('misc', 'Miscellaneous', 'Other tokens', 99);

-- ============================================================
-- Indexes for fast queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_variables_tailwind ON variables(tailwind_name, tailwind_shade);
CREATE INDEX IF NOT EXISTS idx_variables_color_system ON variables(color_system);
CREATE INDEX IF NOT EXISTS idx_variables_semantic_role ON variables(semantic_role);
CREATE INDEX IF NOT EXISTS idx_variables_token_type ON variables(token_type);
CREATE INDEX IF NOT EXISTS idx_variables_css_var ON variables(css_variable);
CREATE INDEX IF NOT EXISTS idx_variables_is_alias ON variables(is_alias);

CREATE INDEX IF NOT EXISTS idx_bindings_node ON variable_bindings(node_id);
CREATE INDEX IF NOT EXISTS idx_bindings_variable ON variable_bindings(variable_id);
CREATE INDEX IF NOT EXISTS idx_bindings_property ON variable_bindings(property);

CREATE INDEX IF NOT EXISTS idx_aliases_source ON variable_aliases(source_variable_id);
CREATE INDEX IF NOT EXISTS idx_aliases_target ON variable_aliases(target_variable_id);

CREATE INDEX IF NOT EXISTS idx_mode_values_variable ON variable_mode_values(variable_id);
CREATE INDEX IF NOT EXISTS idx_mode_values_mode ON variable_mode_values(mode_id);

CREATE INDEX IF NOT EXISTS idx_tailwind_colors_name ON tailwind_colors(name);
CREATE INDEX IF NOT EXISTS idx_tailwind_colors_hex ON tailwind_colors(hex);

-- ============================================================
-- Update FTS5 index to include new fields
-- ============================================================
-- Drop and recreate variables_fts with additional columns
DROP TRIGGER IF EXISTS variables_ai;
DROP TRIGGER IF EXISTS variables_ad;
DROP TRIGGER IF EXISTS variables_au;
DROP TABLE IF EXISTS variables_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS variables_fts USING fts5(
    name,
    daisyui_name,
    daisyui_category,
    tailwind_name,
    tailwind_shade,
    color_system,
    semantic_role,
    token_type,
    description,
    content=variables
);

-- Recreate triggers for FTS sync
CREATE TRIGGER IF NOT EXISTS variables_ai AFTER INSERT ON variables BEGIN
  INSERT INTO variables_fts(rowid, name, daisyui_name, daisyui_category, tailwind_name, tailwind_shade, color_system, semantic_role, token_type, description)
  VALUES (new.rowid, new.name, new.daisyui_name, new.daisyui_category, new.tailwind_name, new.tailwind_shade, new.color_system, new.semantic_role, new.token_type, new.description);
END;

CREATE TRIGGER IF NOT EXISTS variables_ad AFTER DELETE ON variables BEGIN
  INSERT INTO variables_fts(variables_fts, rowid, name, daisyui_name, daisyui_category, tailwind_name, tailwind_shade, color_system, semantic_role, token_type, description)
  VALUES ('delete', old.rowid, old.name, old.daisyui_name, old.daisyui_category, old.tailwind_name, old.tailwind_shade, old.color_system, old.semantic_role, old.token_type, old.description);
END;

CREATE TRIGGER IF NOT EXISTS variables_au AFTER UPDATE ON variables BEGIN
  INSERT INTO variables_fts(variables_fts, rowid, name, daisyui_name, daisyui_category, tailwind_name, tailwind_shade, color_system, semantic_role, token_type, description)
  VALUES ('delete', old.rowid, old.name, old.daisyui_name, old.daisyui_category, old.tailwind_name, old.tailwind_shade, old.color_system, old.semantic_role, old.token_type, old.description);
  INSERT INTO variables_fts(rowid, name, daisyui_name, daisyui_category, tailwind_name, tailwind_shade, color_system, semantic_role, token_type, description)
  VALUES (new.rowid, new.name, new.daisyui_name, new.daisyui_category, new.tailwind_name, new.tailwind_shade, new.color_system, new.semantic_role, new.token_type, new.description);
END;

-- ============================================================
-- Populate Tailwind Colors Reference
-- ============================================================
-- Slate
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('slate', '50', '#f8fafc'), ('slate', '100', '#f1f5f9'), ('slate', '200', '#e2e8f0'),
    ('slate', '300', '#cbd5e1'), ('slate', '400', '#94a3b8'), ('slate', '500', '#64748b'),
    ('slate', '600', '#475569'), ('slate', '700', '#334155'), ('slate', '800', '#1e293b'),
    ('slate', '900', '#0f172a'), ('slate', '950', '#020617');

-- Gray
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('gray', '50', '#f9fafb'), ('gray', '100', '#f3f4f6'), ('gray', '200', '#e5e7eb'),
    ('gray', '300', '#d1d5db'), ('gray', '400', '#9ca3af'), ('gray', '500', '#6b7280'),
    ('gray', '600', '#4b5563'), ('gray', '700', '#374151'), ('gray', '800', '#1f2937'),
    ('gray', '900', '#111827'), ('gray', '950', '#030712');

-- Zinc
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('zinc', '50', '#fafafa'), ('zinc', '100', '#f4f4f5'), ('zinc', '200', '#e4e4e7'),
    ('zinc', '300', '#d4d4d8'), ('zinc', '400', '#a1a1aa'), ('zinc', '500', '#71717a'),
    ('zinc', '600', '#52525b'), ('zinc', '700', '#3f3f46'), ('zinc', '800', '#27272a'),
    ('zinc', '900', '#18181b'), ('zinc', '950', '#09090b');

-- Neutral
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('neutral', '50', '#fafafa'), ('neutral', '100', '#f5f5f5'), ('neutral', '200', '#e5e5e5'),
    ('neutral', '300', '#d4d4d4'), ('neutral', '400', '#a3a3a3'), ('neutral', '500', '#737373'),
    ('neutral', '600', '#525252'), ('neutral', '700', '#404040'), ('neutral', '800', '#262626'),
    ('neutral', '900', '#171717'), ('neutral', '950', '#0a0a0a');

-- Stone
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('stone', '50', '#fafaf9'), ('stone', '100', '#f5f5f4'), ('stone', '200', '#e7e5e4'),
    ('stone', '300', '#d6d3d1'), ('stone', '400', '#a8a29e'), ('stone', '500', '#78716c'),
    ('stone', '600', '#57534e'), ('stone', '700', '#44403c'), ('stone', '800', '#292524'),
    ('stone', '900', '#1c1917'), ('stone', '950', '#0c0a09');

-- Red
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('red', '50', '#fef2f2'), ('red', '100', '#fee2e2'), ('red', '200', '#fecaca'),
    ('red', '300', '#fca5a5'), ('red', '400', '#f87171'), ('red', '500', '#ef4444'),
    ('red', '600', '#dc2626'), ('red', '700', '#b91c1c'), ('red', '800', '#991b1b'),
    ('red', '900', '#7f1d1d'), ('red', '950', '#450a0a');

-- Orange
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('orange', '50', '#fff7ed'), ('orange', '100', '#ffedd5'), ('orange', '200', '#fed7aa'),
    ('orange', '300', '#fdba74'), ('orange', '400', '#fb923c'), ('orange', '500', '#f97316'),
    ('orange', '600', '#ea580c'), ('orange', '700', '#c2410c'), ('orange', '800', '#9a3412'),
    ('orange', '900', '#7c2d12'), ('orange', '950', '#431407');

-- Amber
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('amber', '50', '#fffbeb'), ('amber', '100', '#fef3c7'), ('amber', '200', '#fde68a'),
    ('amber', '300', '#fcd34d'), ('amber', '400', '#fbbf24'), ('amber', '500', '#f59e0b'),
    ('amber', '600', '#d97706'), ('amber', '700', '#b45309'), ('amber', '800', '#92400e'),
    ('amber', '900', '#78350f'), ('amber', '950', '#451a03');

-- Yellow
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('yellow', '50', '#fefce8'), ('yellow', '100', '#fef9c3'), ('yellow', '200', '#fef08a'),
    ('yellow', '300', '#fde047'), ('yellow', '400', '#facc15'), ('yellow', '500', '#eab308'),
    ('yellow', '600', '#ca8a04'), ('yellow', '700', '#a16207'), ('yellow', '800', '#854d0e'),
    ('yellow', '900', '#713f12'), ('yellow', '950', '#422006');

-- Lime
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('lime', '50', '#f7fee7'), ('lime', '100', '#ecfccb'), ('lime', '200', '#d9f99d'),
    ('lime', '300', '#bef264'), ('lime', '400', '#a3e635'), ('lime', '500', '#84cc16'),
    ('lime', '600', '#65a30d'), ('lime', '700', '#4d7c0f'), ('lime', '800', '#3f6212'),
    ('lime', '900', '#365314'), ('lime', '950', '#1a2e05');

-- Green
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('green', '50', '#f0fdf4'), ('green', '100', '#dcfce7'), ('green', '200', '#bbf7d0'),
    ('green', '300', '#86efac'), ('green', '400', '#4ade80'), ('green', '500', '#22c55e'),
    ('green', '600', '#16a34a'), ('green', '700', '#15803d'), ('green', '800', '#166534'),
    ('green', '900', '#14532d'), ('green', '950', '#052e16');

-- Emerald
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('emerald', '50', '#ecfdf5'), ('emerald', '100', '#d1fae5'), ('emerald', '200', '#a7f3d0'),
    ('emerald', '300', '#6ee7b7'), ('emerald', '400', '#34d399'), ('emerald', '500', '#10b981'),
    ('emerald', '600', '#059669'), ('emerald', '700', '#047857'), ('emerald', '800', '#065f46'),
    ('emerald', '900', '#064e3b'), ('emerald', '950', '#022c22');

-- Teal
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('teal', '50', '#f0fdfa'), ('teal', '100', '#ccfbf1'), ('teal', '200', '#99f6e4'),
    ('teal', '300', '#5eead4'), ('teal', '400', '#2dd4bf'), ('teal', '500', '#14b8a6'),
    ('teal', '600', '#0d9488'), ('teal', '700', '#0f766e'), ('teal', '800', '#115e59'),
    ('teal', '900', '#134e4a'), ('teal', '950', '#042f2e');

-- Cyan
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('cyan', '50', '#ecfeff'), ('cyan', '100', '#cffafe'), ('cyan', '200', '#a5f3fc'),
    ('cyan', '300', '#67e8f9'), ('cyan', '400', '#22d3ee'), ('cyan', '500', '#06b6d4'),
    ('cyan', '600', '#0891b2'), ('cyan', '700', '#0e7490'), ('cyan', '800', '#155e75'),
    ('cyan', '900', '#164e63'), ('cyan', '950', '#083344');

-- Sky
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('sky', '50', '#f0f9ff'), ('sky', '100', '#e0f2fe'), ('sky', '200', '#bae6fd'),
    ('sky', '300', '#7dd3fc'), ('sky', '400', '#38bdf8'), ('sky', '500', '#0ea5e9'),
    ('sky', '600', '#0284c7'), ('sky', '700', '#0369a1'), ('sky', '800', '#075985'),
    ('sky', '900', '#0c4a6e'), ('sky', '950', '#082f49');

-- Blue
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('blue', '50', '#eff6ff'), ('blue', '100', '#dbeafe'), ('blue', '200', '#bfdbfe'),
    ('blue', '300', '#93c5fd'), ('blue', '400', '#60a5fa'), ('blue', '500', '#3b82f6'),
    ('blue', '600', '#2563eb'), ('blue', '700', '#1d4ed8'), ('blue', '800', '#1e40af'),
    ('blue', '900', '#1e3a8a'), ('blue', '950', '#172554');

-- Indigo
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('indigo', '50', '#eef2ff'), ('indigo', '100', '#e0e7ff'), ('indigo', '200', '#c7d2fe'),
    ('indigo', '300', '#a5b4fc'), ('indigo', '400', '#818cf8'), ('indigo', '500', '#6366f1'),
    ('indigo', '600', '#4f46e5'), ('indigo', '700', '#4338ca'), ('indigo', '800', '#3730a3'),
    ('indigo', '900', '#312e81'), ('indigo', '950', '#1e1b4b');

-- Violet
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('violet', '50', '#f5f3ff'), ('violet', '100', '#ede9fe'), ('violet', '200', '#ddd6fe'),
    ('violet', '300', '#c4b5fd'), ('violet', '400', '#a78bfa'), ('violet', '500', '#8b5cf6'),
    ('violet', '600', '#7c3aed'), ('violet', '700', '#6d28d9'), ('violet', '800', '#5b21b6'),
    ('violet', '900', '#4c1d95'), ('violet', '950', '#2e1065');

-- Purple
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('purple', '50', '#faf5ff'), ('purple', '100', '#f3e8ff'), ('purple', '200', '#e9d5ff'),
    ('purple', '300', '#d8b4fe'), ('purple', '400', '#c084fc'), ('purple', '500', '#a855f7'),
    ('purple', '600', '#9333ea'), ('purple', '700', '#7e22ce'), ('purple', '800', '#6b21a8'),
    ('purple', '900', '#581c87'), ('purple', '950', '#3b0764');

-- Fuchsia
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('fuchsia', '50', '#fdf4ff'), ('fuchsia', '100', '#fae8ff'), ('fuchsia', '200', '#f5d0fe'),
    ('fuchsia', '300', '#f0abfc'), ('fuchsia', '400', '#e879f9'), ('fuchsia', '500', '#d946ef'),
    ('fuchsia', '600', '#c026d3'), ('fuchsia', '700', '#a21caf'), ('fuchsia', '800', '#86198f'),
    ('fuchsia', '900', '#701a75'), ('fuchsia', '950', '#4a044e');

-- Pink
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('pink', '50', '#fdf2f8'), ('pink', '100', '#fce7f3'), ('pink', '200', '#fbcfe8'),
    ('pink', '300', '#f9a8d4'), ('pink', '400', '#f472b6'), ('pink', '500', '#ec4899'),
    ('pink', '600', '#db2777'), ('pink', '700', '#be185d'), ('pink', '800', '#9d174d'),
    ('pink', '900', '#831843'), ('pink', '950', '#500724');

-- Rose
INSERT OR IGNORE INTO tailwind_colors (name, shade, hex) VALUES
    ('rose', '50', '#fff1f2'), ('rose', '100', '#ffe4e6'), ('rose', '200', '#fecdd3'),
    ('rose', '300', '#fda4af'), ('rose', '400', '#fb7185'), ('rose', '500', '#f43f5e'),
    ('rose', '600', '#e11d48'), ('rose', '700', '#be123c'), ('rose', '800', '#9f1239'),
    ('rose', '900', '#881337'), ('rose', '950', '#4c0519');

-- ============================================================
-- Populate DaisyUI Semantic Colors Reference
-- ============================================================
INSERT OR IGNORE INTO daisyui_colors (name, css_variable, category, description, default_hex, usage_hint) VALUES
    -- Brand colors
    ('primary', '--p', 'brand', 'Primary brand color', '#570df8', 'Use for primary actions, links, and brand elements'),
    ('primary-content', '--pc', 'brand', 'Text/icon color on primary background', '#ffffff', 'Use for text on primary background'),
    ('secondary', '--s', 'brand', 'Secondary brand color', '#f000b8', 'Use for secondary actions and accents'),
    ('secondary-content', '--sc', 'brand', 'Text/icon color on secondary background', '#ffffff', 'Use for text on secondary background'),
    ('accent', '--a', 'brand', 'Accent color for highlights', '#37cdbe', 'Use for highlights, badges, and decorative elements'),
    ('accent-content', '--ac', 'brand', 'Text/icon color on accent background', '#163835', 'Use for text on accent background'),

    -- Neutral/base colors
    ('neutral', '--n', 'base', 'Neutral color', '#3d4451', 'Use for neutral backgrounds and text'),
    ('neutral-content', '--nc', 'base', 'Text/icon color on neutral background', '#ffffff', 'Use for text on neutral background'),
    ('base-100', '--b1', 'base', 'Base background color', '#ffffff', 'Primary background color'),
    ('base-200', '--b2', 'base', 'Slightly darker background', '#f2f2f2', 'Secondary/card background'),
    ('base-300', '--b3', 'base', 'Even darker background', '#e5e5e5', 'Tertiary/hover background'),
    ('base-content', '--bc', 'base', 'Default text color on base', '#1f2937', 'Default text color'),

    -- State/feedback colors
    ('info', '--in', 'state', 'Informational messages', '#3abff8', 'Use for info alerts and messages'),
    ('info-content', '--inc', 'state', 'Text on info background', '#002b3d', 'Text on info background'),
    ('success', '--su', 'state', 'Success messages', '#36d399', 'Use for success states and confirmations'),
    ('success-content', '--suc', 'state', 'Text on success background', '#003320', 'Text on success background'),
    ('warning', '--wa', 'state', 'Warning messages', '#fbbd23', 'Use for warnings and cautions'),
    ('warning-content', '--wac', 'state', 'Text on warning background', '#382800', 'Text on warning background'),
    ('error', '--er', 'state', 'Error messages', '#f87272', 'Use for errors and destructive actions'),
    ('error-content', '--erc', 'state', 'Text on error background', '#470000', 'Text on error background');

-- ============================================================
-- Update schema version
-- ============================================================
INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES ('schema_version', '2.0', datetime('now'));
