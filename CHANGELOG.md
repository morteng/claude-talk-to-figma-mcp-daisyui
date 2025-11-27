# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-11-27 (DaisyUI Edition - Variable Binding)

### Added
- **Variable Binding Tools**: Complete support for Figma variables (design tokens).
  - `get_local_variables`: Get all local variables organized by collection.
  - `get_variable_collections`: Get variable collections with modes (light/dark theme).
  - `get_bound_variables`: Inspect which variables are bound to a node's properties.
  - `set_fill_variable`: Bind a color variable to a node's fill for theme-compatible colors.
  - `set_stroke_variable`: Bind a color variable to a node's stroke.
  - `resolve_variable_by_name`: Find a variable ID by its semantic name (e.g., 'base-100', 'primary').
  - `clear_variable_binding`: Remove a variable binding from a node property.

- **Style Binding Tools**: Apply predefined styles to nodes.
  - `set_fill_style_id`: Apply a fill style to a node.
  - `set_stroke_style_id`: Apply a stroke style to a node.
  - `set_text_style_id`: Apply a text style to a text node.

- **Variable Caching & Search**: Variables are now stored in the local SQLite index for fast access.
  - `search_cached_variables`: Search locally cached variables by name or DaisyUI mapping.
  - `list_cached_color_variables`: List all color variables grouped by DaisyUI category.
  - `list_cached_variable_collections`: List variable collections with modes and variable counts.
  - `get_cached_variable_by_daisyui`: Find a variable by its DaisyUI semantic name.
  - Auto-sync: Variables are automatically fetched and cached during `build_index`.
  - FTS5 search: Full-text search across variable names and DaisyUI mappings.

- **Per-Document Database Caching**: Each Figma document now gets its own SQLite database file.
  - Switching between Figma files automatically uses the correct cached data.
  - `list_cached_documents`: List all Figma documents that have been indexed locally.
  - Database files named `figma-index-{document_id}.db` in the cache directory.
  - No more data overwrites when working with multiple Figma files.

### Why This Matters
- **Theme Compatibility**: Bound variables automatically switch with Figma modes (light/dark theme).
- **Design Tokens**: Variables represent DaisyUI semantic colors (base-100, primary, etc.).
- **No Hardcoding**: Use `set_fill_variable` instead of `set_fill_color` for proper theming.
- **Fast Lookups**: Cached variables enable instant search without Figma round-trips.

### Technical Details
- Uses `figma.variables.setBoundVariableForPaint()` API for fill/stroke bindings.
- Variable resolution supports fuzzy name matching and collection filtering.
- Style binding supports both local styles and library imports via `importStyleByKeyAsync`.
- New SQLite tables: `variables` and `variable_collections` with FTS5 search index.
- DaisyUI auto-detection maps variable names to semantic categories (primary, base, state, etc.).

## [0.8.0] - 2025-11-27 (DaisyUI Edition - Extended)

### Added
- **Design Token Extraction**: New `extract_design_tokens` tool to extract colors, spacing, typography, and shadows. Outputs in Tailwind config or CSS variables format.
- **i18n Text Extraction**: New `extract_text_nodes` tool to extract all text from Figma frames with suggested i18n keys and namespaces for internationalization.
- **Accessibility Audit**: New `audit_accessibility` tool for WCAG 2.1 AA/AAA compliance checks including contrast ratios, touch target sizes, and text size minimums.
- **Component Registry Sync**: New `sync_component_registry` tool to compare Figma designs with local component registry YAML files and detect drift.
- **Visual Regression Export**: New `export_for_comparison` tool to export frames for visual regression testing.
- **Real-Time Change Notifications**: Figma plugin now broadcasts document changes, selection changes, and page changes to the MCP server.
- **Auto-Index Invalidation**: Index automatically invalidates and rebuilds when document changes are detected (node creation/deletion or >5 property changes).
- **Index Status Tool**: New `index_status` tool to check sync health, invalidation state, and cache statistics.

### Changed
- **Enhanced Figma Plugin**: Added `documentchange`, `selectionchange`, and `currentpagechange` event listeners with throttled (1s) notification relay.
- **Improved Auto-Sync**: Index now auto-rebuilds on first query, when stale (>5 minutes), or when invalidated by document changes.
- **WebSocket Handler**: Added change notification callback registration and routing in MCP server.
- **Documentation**: Comprehensive README update documenting all new tools, workflows, and the Ampæra project context.

### Technical Details
- Added WCAG 2.1 contrast ratio calculation using relative luminance formula.
- Implemented YAML parsing for component registry sync.
- Change notification pipeline: Plugin → WebSocket → MCP Server → Cache Invalidation.
- Throttling prevents notification spam during rapid document edits.

## [0.7.0] - 2025-11-27 (DaisyUI Edition)

### Added
- **Local SQLite Index**: Fast queries without Figma round-trips using SQLite FTS5.
- **FTS5 Fuzzy Search**: Natural language component search ("primary button", "login form").
- **DaisyUI Auto-Detection**: Automatic mapping of Figma nodes to DaisyUI classes.
- **Tailwind Extraction**: Convert Figma styles to Tailwind CSS utilities.
- **Code Generation**: Generate Jinja/HTMX templates and Playwright Page Objects from Figma frames.
- **Agent-Optimized Responses**: 99% smaller responses with ready-to-use clone commands.
- **Component Registry YAML**: Generate component registry entries.
- **Prototype Tools**: Create/get/remove prototype links, configure scroll behavior.

### Technical Details
- SQLite with FTS5 for fast full-text search across indexed nodes.
- DaisyUI component detection via naming patterns and style analysis.
- Tailwind class extraction from Figma styles (colors, spacing, typography, shadows, radii).
- Jinja template generation with HTMX and Alpine.js attribute support.

## [0.6.1] - 2025-08-02

### Fixed
- **`set_stroke_color` Tool**: Corrected a validation rule that incorrectly rejected a `strokeWeight` of `0`. This change allows for the creation of invisible strokes, aligning the tool's behavior with Figma's capabilities. (Thanks to [Taylor Smits](https://github.com/smitstay) - [PR #16](https://github.com/arinspunk/claude-talk-to-figma-mcp/pull/16))

## [0.6.0] - 2025-07-15

### Added
- **🚀 DXT Package Support**: Complete implementation of Anthropic's Desktop Extensions format for Claude Desktop
- **📦 Automated CI/CD Pipeline**: GitHub Actions workflow for automatic DXT package generation and release distribution
- **🔧 DXT Build Scripts**: New npm scripts for DXT packaging (`pack`, `build:dxt`, `sync-version`)
- **📋 .dxtignore Configuration**: Optimized package exclusions for minimal DXT file size (11.6MB compressed)
- **🎯 Dual Distribution Strategy**: NPM registry for developers + DXT packages for end users

### Changed
- **⚡ Installation Experience**: Reduced setup time from 15-30 minutes to 2-5 minutes via one-click DXT installation
- **📖 Documentation**: Enhanced README with comprehensive DXT installation instructions and troubleshooting
- **🏗️ Build Process**: Improved version synchronization between package.json and manifest.json
- **🔄 Release Workflow**: Automated DXT package attachment to GitHub releases

### Technical Details
- Added `@anthropic-ai/dxt@^0.2.0` development dependency for DXT packaging
- Implemented robust error handling and validation in CI/CD pipeline
- Enhanced build artifacts with 90-day retention for testing and rollback capabilities
- Established quality gates ensuring DXT packages only build after successful test suites

### Credits
- **DXT Implementation**: [Taylor Smits](https://github.com/smitstay) - [PR #17](https://github.com/arinspunk/claude-talk-to-figma-mcp/pull/17)

## [0.5.3] - 2025-06-20

### Added
- Added Windows-specific build command (`build:win`: `tsup`) for improved cross-platform compatibility
- Enhanced build process to support development on Windows systems without chmod dependency

### Fixed
- Resolved Windows build compatibility issues where `chmod` command would fail on Windows systems
- Improved developer experience for Windows users by providing dedicated build script

### Changed
- Separated Unix/Linux build process (with executable permissions) from Windows build process
- Updated installation documentation to reflect platform-specific build commands

## [0.5.2] - 2025-06-19

### Fixed
- Fixed critical opacity handling bug in `set_stroke_color` where `a: 0` (transparent) was incorrectly converted to `a: 1` (opaque)
- Fixed stroke weight handling where `strokeWeight: 0` (no border) was incorrectly converted to `strokeWeight: 1`
- Resolved problematic `||` operator usage that affected falsy values in color and stroke operations

### Added
- Extended `applyDefault()` utility function to handle stroke weight defaults safely
- Added `FIGMA_DEFAULTS.stroke.weight` constant for centralized stroke configuration
- Comprehensive test suite for `set_stroke_color` covering edge cases and integration scenarios
- Enhanced validation for RGB components in stroke operations

### Changed
- Improved architectural consistency by applying the same safe defaults pattern from `set_fill_color` to `set_stroke_color`
- Enhanced separation of concerns between MCP layer (business logic) and Figma plugin (pure translator)
- Renamed `weight` parameter to `strokeWeight` for better clarity and consistency
- Updated Figma plugin to expect complete data from MCP layer instead of handling defaults internally

### Technical Details
- Replaced `strokeWeight: strokeWeight || 1` with `applyDefault(strokeWeight, FIGMA_DEFAULTS.stroke.weight)`
- Enhanced type safety with proper `Color` and `ColorWithDefaults` interface usage
- Improved error messages and validation for better debugging experience

## [0.5.1] - 2025-06-15

### Fixed
- Fixed opacity handling in `set_fill_color` to properly respect alpha values
- Added `applyColorDefaults` function to ensure appropriate default values for colors

### Added
- Added automated tests for color functions and node manipulation

### Changed
- Improved TypeScript typing for colors and related properties
- General code cleanup and better utility organization

## [0.5.0] - 2025-05-28

### Changed
- Implemented modular tool structure for better maintainability
- Enhanced handling of complex operations with timeouts and chunking
- Improved error handling and recovery for all tools
- Improved TypeScript typing and standardized error handling

### Fixed
- Fixed channel connection issues with improved state management
- Resolved timeout problems in `flatten_node`, `create_component_instance`, and `set_effect_style_id`
- Enhanced remote component access with better error handling

### Added
- Comprehensive documentation of tool categories and capabilities

## [0.4.0] - 2025-04-15

### Added
- New tools for creating advanced shapes:
  - `create_ellipse`: Creation of ellipses and circles
  - `create_polygon`: Creation of polygons with customizable sides
  - `create_star`: Creation of stars with customizable points and inner radius
  - `create_vector`: Creation of complex vector shapes
  - `create_line`: Creation of straight lines
- Advanced text and font manipulation capabilities
- New commands for controlling typography: font styles, spacing, text case, and more
- Support for accessing team library components
- Improved error handling and timeout management
- Enhanced text scanning capabilities

### Changed
- Improvements in documentation and usage examples

## [0.3.0] - 2025-03-10

### Added
- Added `set_auto_layout` command to configure auto layout properties for frames and groups
- Support for settings for layout direction, padding, item spacing, alignment and more

## [0.2.0] - 2025-02-01

### Added
- Initial public release with Claude Desktop support
