<img src="images/claude-talk-to-figma.png" alt="Claude Talk to Figma collage" />

# Claude Talk to Figma MCP - DaisyUI Edition

A Model Context Protocol (MCP) plugin that allows Claude Desktop and other AI tools to interact directly with Figma, **enhanced with intelligent DaisyUI component detection, local caching for fast queries, HTMX/Tailwind code generation, design token extraction, accessibility auditing, and real-time change notifications**.

> **Fork of**: [arinspunk/claude-talk-to-figma-mcp](https://github.com/arinspunk/claude-talk-to-figma-mcp)
> Original credit to Sonny Lazuardi and Xúlio Zé

---

## Project Context

This fork was developed for the **Ampæra Energy Platform** project, a Norwegian smart home energy management system. While customized for our specific workflow (HTMX + DaisyUI + Tailwind + Playwright), the tools are general-purpose and work with any Figma project.

**Customizations specific to Ampæra:**
- Component registry format matches our `docs/ui/component-registry/*.yaml` structure
- Page Object generation follows our Playwright test conventions
- Design token extraction optimized for our Tailwind config

All tools work standalone and can be adapted to other project structures.

---

## New in v0.8.0 - Comprehensive Figma-to-Code Pipeline

| Feature | Description |
|---------|-------------|
| **Design Token Extraction** | Extract colors, spacing, typography, shadows → Tailwind config or CSS variables |
| **i18n Text Extraction** | Extract all text nodes with suggested i18n keys and namespaces |
| **Accessibility Audit** | WCAG 2.1 AA/AAA audit (contrast ratios, touch targets, text sizes) |
| **Component Registry Sync** | Compare Figma designs with local component registry YAML |
| **Visual Regression Export** | Export frames for visual regression testing |
| **Real-Time Change Notifications** | Auto-sync index when Figma document changes |

---

## DaisyUI Edition Features

This fork adds powerful features for DaisyUI + Tailwind + HTMX workflows:

| Feature | Benefit |
|---------|---------|
| **Local SQLite Index** | 100x faster queries - no Figma round-trips |
| **FTS5 Fuzzy Search** | Find components with natural language ("primary button") |
| **DaisyUI Auto-Detection** | Automatic mapping of Figma nodes to DaisyUI classes |
| **Tailwind Extraction** | Convert Figma styles to Tailwind utilities |
| **Jinja/HTMX Templates** | Generate server-rendered templates from designs |
| **Page Object Generator** | Create Playwright test objects from Figma |
| **Auto-Sync on Changes** | Index automatically updates when Figma document changes |
| **Agent-Optimized Responses** | 99% smaller responses with ready-to-use clone commands |

---

## All Tools

### Index & Search Tools

| Tool | Description |
|------|-------------|
| `build_index` | Build local SQLite index from Figma document (auto-runs on first query) |
| `index_status` | Check index health, sync status, invalidation state |
| `search` | Natural language search: "primary button", "login form" |
| `list_components` | List all components in a category (buttons, forms, cards) |
| `get_by_daisyui` | Find component by DaisyUI class (btn-primary) |
| `list_pages` | Quick overview of all pages |
| `get_page_tree` | Hierarchical page structure (much smaller than full export) |

### Code Generation Tools

| Tool | Description |
|------|-------------|
| `generate_template` | Generate Jinja/HTML with HTMX and Alpine.js attributes |
| `extract_tailwind` | Extract Tailwind classes from Figma node styles |
| `generate_page_object` | Create Playwright Page Objects (TypeScript or Python) |
| `generate_registry_entry` | Generate component registry YAML entry |

### Design Token Tools (NEW)

| Tool | Description |
|------|-------------|
| `extract_design_tokens` | Extract colors, spacing, typography, shadows → Tailwind config or CSS vars |

### i18n & Accessibility Tools (NEW)

| Tool | Description |
|------|-------------|
| `extract_text_nodes` | Extract all text for i18n validation with suggested keys |
| `audit_accessibility` | WCAG 2.1 AA/AAA audit (contrast, touch targets, text sizes) |

### Component Registry Tools (NEW)

| Tool | Description |
|------|-------------|
| `sync_component_registry` | Compare Figma with local registry YAML, detect drift |

### Visual Testing Tools (NEW)

| Tool | Description |
|------|-------------|
| `export_for_comparison` | Export frames for visual regression testing |

### Prototype & Interaction Tools

| Tool | Description |
|------|-------------|
| `set_prototype_link` | Create interactive links between frames (click to navigate) |
| `get_prototype_links` | List all prototype links from a node/frame |
| `remove_prototype_link` | Remove prototype interactions from a node |
| `set_scroll_behavior` | Configure scroll overflow on frames |

### Utility Tools

| Tool | Description |
|------|-------------|
| `extract_node_styles` | Extract styles optimized for Tailwind/DaisyUI mapping |
| `get_page_structure` | Compact page structure for indexing |
| `batch_get_nodes` | Batch fetch multiple nodes with minimal data |
| `rename_node` | Rename any Figma node |
| `set_visibility` | Show/hide nodes |
| `set_opacity` | Set node opacity (0-1) |
| `lock_node` | Lock/unlock nodes from editing |

---

## Installation

### 1. Prerequisites
- [Claude Desktop](https://claude.ai/download) + [Figma Desktop](https://www.figma.com/downloads/) + [Bun](https://bun.sh)

### 2. Clone and Build
```bash
git clone https://github.com/morteng/claude-talk-to-figma-mcp-daisyui.git
cd claude-talk-to-figma-mcp-daisyui
bun install
bun run build
```

### 3. Configure Claude Desktop
Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "figma": {
      "command": "/path/to/bun",
      "args": ["run", "/path/to/claude-talk-to-figma-mcp-daisyui/dist/talk_to_figma_mcp/server.js"],
      "env": {
        "FIGMA_CACHE_DIR": "/path/to/cache/dir"
      }
    }
  }
}
```

### 4. Setup Figma Plugin
Import `src/claude_mcp_plugin/manifest.json` in Figma → Plugins → Development

### 5. First Connection
```bash
# Terminal 1: Start WebSocket server
bun socket

# Terminal 2: Use Claude
"Connect to Figma channel abc-123"
"Search for primary buttons"  # Index auto-builds on first query
```

---

## Usage Examples

### Design Token Extraction
```
"Extract design tokens as Tailwind config"
→ Generates theme.extend with colors, spacing, typography, shadows

"Extract design tokens as CSS variables"
→ Generates :root { --color-primary: #...; } format
```

### Accessibility Audit
```
"Audit the login page for accessibility"
→ Returns WCAG 2.1 AA/AAA violations with severity levels

Example output:
- Error: Contrast ratio 2.1 (needs 4.5 for AA)
- Warning: Touch target 32x32px (recommended 44x44px)
- Error: Text size 10px below minimum 12px
```

### i18n Text Extraction
```
"Extract text nodes from the settings page with namespace 'settings'"
→ Returns all text with suggested i18n keys

Example output:
- "Save Changes" → settings.save_changes
- "Account Settings" → settings.account_title
```

### Component Registry Sync
```
"Sync component registry for the dashboard page"
→ Compares Figma with local YAML files

Example output:
- in_registry_not_figma: ["old-component"]
- in_figma_not_registry: ["new-feature-card"]
- name_mismatches: [{"figma": "Stats Card", "registry": "stat-card"}]
```

### Visual Regression Export
```
"Export the dashboard frames for visual regression testing"
→ Exports frames as PNG at specified scale
```

### Code Generation
```
"Generate a Jinja template from node 123:456"
→ Produces HTMX-ready template with DaisyUI classes

"Generate a Playwright Page Object for the Login page in Python"
→ Creates Python test helper with selectors
```

### Prototype Interactions
```
"Link the Login button to the Dashboard frame"
→ Creates ON_CLICK prototype link with smooth transition

"Show all prototype links in the navigation bar"
→ Lists all interactive elements and their destinations
```

---

## Auto-Sync Behavior

The index automatically stays in sync with your Figma document:

| Event | Behavior |
|-------|----------|
| **First query** | Auto-builds index if empty |
| **Document changes** | Index invalidates on node creation/deletion or >5 property changes |
| **Stale index** | Auto-rebuilds if >5 minutes old |
| **Not connected** | Uses cached index with warning |

Check sync status anytime with `index_status`.

### Change Notification Flow

```
Figma Document Change
        ↓
Plugin Event Listener (throttled, 1s minimum)
        ↓
WebSocket Notification
        ↓
MCP Server Handler
        ↓
Index Invalidation Flag
        ↓
Next Query → Auto-rebuild
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE                               │
└───────────────────────────────────┬─────────────────────────────┘
                                    │ MCP Protocol
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              DAISYUI EDITION MCP SERVER                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ SQLite FTS5 │  │ DaisyUI      │  │ Code Generator     │     │
│  │ Index       │  │ Component    │  │ - Jinja/HTMX       │     │
│  │ - Nodes     │  │ Detector     │  │ - Tailwind         │     │
│  │ - Components│  │ - Colors     │  │ - Page Objects     │     │
│  │ - Pages     │  │ - Patterns   │  │ - Registry YAML    │     │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────┘     │
│         │                │                                       │
│  ┌──────┴────────────────┴───────────────────────────────────┐  │
│  │              NEW TOOLS (v0.8.0)                            │  │
│  │  - Design Token Extraction    - Accessibility Audit       │  │
│  │  - i18n Text Extraction       - Component Registry Sync   │  │
│  │  - Visual Regression Export   - Change Notifications      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                Original Tools (50+)                        │  │
│  │  Document, Creation, Modification, Text, Components        │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket + Change Notifications
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIGMA PLUGIN                                │
│  - Document change listener                                      │
│  - Selection change listener                                     │
│  - Page change listener                                          │
│  - Throttled notification relay                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## DaisyUI Component Categories

The index automatically categorizes components:

| Category | Components |
|----------|------------|
| `buttons` | btn, btn-primary, btn-secondary, btn-ghost, etc. |
| `forms` | input, select, checkbox, radio, toggle, textarea |
| `cards` | card, card-compact, card-bordered |
| `navigation` | navbar, tabs, breadcrumbs, menu |
| `feedback` | alert, toast, modal, tooltip, progress, loading |
| `data-display` | stats, avatar, badge, table |
| `layout` | hero, footer, divider, drawer |
| `misc` | collapse, rating, link |

---

## Testing

```bash
bun run test            # Unit tests
bun run test:coverage   # Coverage report
bun run test:integration # Integration testing
```

---

## Version History

### 0.8.0 (DaisyUI Edition - Extended)
- **Design Token Extraction**: Extract colors, spacing, typography → Tailwind config or CSS vars
- **i18n Text Extraction**: Extract text nodes with suggested i18n keys
- **Accessibility Audit**: WCAG 2.1 AA/AAA audit (contrast, touch targets, text sizes)
- **Component Registry Sync**: Compare Figma with local YAML registry
- **Visual Regression Export**: Export frames for visual testing
- **Real-Time Change Notifications**: Auto-sync index on document changes
- **Enhanced Plugin**: Document/selection/page change event listeners
- **Auto-Index Invalidation**: Smart cache invalidation based on change types

### 0.7.0 (DaisyUI Edition)
- **Local SQLite Index**: Fast queries without Figma round-trips
- **FTS5 Search**: Natural language component search
- **DaisyUI Detection**: Automatic component-to-class mapping
- **Tailwind Extraction**: Figma styles → Tailwind utilities
- **Code Generation**: Jinja/HTMX templates, Page Objects
- **Agent-Optimized**: Smaller responses with ready-to-use commands

### Previous (from upstream)
See [CHANGELOG.md](CHANGELOG.md) for upstream history.

---

## License & Credits

**License**: MIT

**This Fork**:
- DaisyUI Edition enhancements for the Ampæra Energy Platform
- Additional tools for comprehensive Figma-to-Code pipeline

**Upstream**:
- [arinspunk/claude-talk-to-figma-mcp](https://github.com/arinspunk/claude-talk-to-figma-mcp) - Claude adaptation by Xúlio Zé
- [cursor-talk-to-figma-mcp](https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp) - Original by Sonny Lazuardi

---

## Contributing

1. Fork this repo
2. Create feature branch: `git checkout -b feature/amazing`
3. Make changes and test
4. Submit PR with clear description

**Focus areas for contribution**:
- Additional DaisyUI component patterns
- More Tailwind mapping coverage
- Enhanced code generation (React, Vue templates)
- Better theme token extraction
- Additional accessibility checks
- More i18n key generation patterns
