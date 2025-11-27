/**
 * Code Generation Tools - DaisyUI Edition
 *
 * Generate Jinja templates, HTMX partials, and Page Objects from Figma designs.
 * Specifically optimized for DaisyUI + Tailwind + HTMX stack.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../utils/websocket.js";
import { cache } from "../cache/index.js";
import { detectDaisyUIComponent, COMPONENT_USAGE_HINTS } from "../daisyui/index.js";
import {
  rgbToHex,
  hexToRgb,
  matchDaisyUIColor,
  spacingToTailwind,
  fontSizeToTailwind,
  fontWeightToTailwind,
  radiusToTailwind,
  colorDistance,
  DAISYUI_COLORS,
  TAILWIND_SPACING,
  TAILWIND_FONT_SIZES
} from "../daisyui/colors.js";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

// WCAG 2.1 AA minimum contrast ratios
const WCAG_CONTRAST_AA_NORMAL = 4.5;
const WCAG_CONTRAST_AA_LARGE = 3.0;
const WCAG_MIN_TOUCH_TARGET = 44; // px

/**
 * Calculate relative luminance for WCAG contrast
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio between two colors
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Extract Tailwind classes from Figma node
 */
function extractTailwindFromNode(node: any): {
  classes: string[];
  customCss: Record<string, string>;
} {
  const classes: string[] = [];
  const customCss: Record<string, string> = {};

  // Layout
  if (node.layoutMode === 'HORIZONTAL') {
    classes.push('flex', 'flex-row');
  } else if (node.layoutMode === 'VERTICAL') {
    classes.push('flex', 'flex-col');
  }

  // Alignment
  if (node.primaryAxisAlignItems) {
    const map: Record<string, string> = {
      'MIN': 'justify-start', 'CENTER': 'justify-center',
      'MAX': 'justify-end', 'SPACE_BETWEEN': 'justify-between'
    };
    if (map[node.primaryAxisAlignItems]) classes.push(map[node.primaryAxisAlignItems]);
  }

  if (node.counterAxisAlignItems) {
    const map: Record<string, string> = {
      'MIN': 'items-start', 'CENTER': 'items-center', 'MAX': 'items-end'
    };
    if (map[node.counterAxisAlignItems]) classes.push(map[node.counterAxisAlignItems]);
  }

  // Gap/Spacing
  if (node.itemSpacing) {
    const gap = spacingToTailwind(node.itemSpacing);
    if (gap) classes.push(`gap-${gap}`);
  }

  // Padding
  if (node.paddingLeft || node.paddingTop || node.paddingRight || node.paddingBottom) {
    const pl = spacingToTailwind(node.paddingLeft || 0);
    const pr = spacingToTailwind(node.paddingRight || 0);
    const pt = spacingToTailwind(node.paddingTop || 0);
    const pb = spacingToTailwind(node.paddingBottom || 0);

    if (pl === pr && pt === pb && pl === pt && pl) {
      classes.push(`p-${pl}`);
    } else {
      if (pl === pr && pl) classes.push(`px-${pl}`);
      else {
        if (pl) classes.push(`pl-${pl}`);
        if (pr) classes.push(`pr-${pr}`);
      }
      if (pt === pb && pt) classes.push(`py-${pt}`);
      else {
        if (pt) classes.push(`pt-${pt}`);
        if (pb) classes.push(`pb-${pb}`);
      }
    }
  }

  // Border radius
  if (node.cornerRadius) {
    classes.push(radiusToTailwind(node.cornerRadius));
  }

  // Colors
  if (node.fills?.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const hex = rgbToHex(fill.color);
      const daisyColor = matchDaisyUIColor(hex);
      if (daisyColor) {
        classes.push(`bg-${daisyColor}`);
      } else {
        customCss.backgroundColor = hex;
      }
    }
  }

  // Typography
  if (node.type === 'TEXT') {
    if (node.fontSize) {
      classes.push(fontSizeToTailwind(node.fontSize));
    }
    if (node.fontWeight) {
      classes.push(fontWeightToTailwind(node.fontWeight));
    }
    if (node.fills?.length > 0 && node.fills[0].type === 'SOLID') {
      const hex = rgbToHex(node.fills[0].color);
      const daisyColor = matchDaisyUIColor(hex);
      if (daisyColor) {
        classes.push(`text-${daisyColor}`);
      }
    }
  }

  return { classes, customCss };
}

/**
 * Generate test ID from node path
 */
function generateTestId(nodePath: string): string {
  return nodePath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 64);
}

/**
 * Register code generation tools
 */
export function registerCodegenTools(server: McpServer): void {

  /**
   * Generate Jinja/HTML template from Figma frame
   */
  server.tool(
    "generate_template",
    "Generate a Jinja/HTML template from a Figma frame. Produces HTMX-ready, server-rendered code with DaisyUI classes.",
    {
      node_id: z.string().describe("Figma node ID to generate template from"),
      format: z.enum(["jinja", "html"]).optional().default("jinja").describe("Output format"),
      htmx: z.boolean().optional().default(true).describe("Add HTMX attributes"),
      alpine: z.boolean().optional().default(false).describe("Add Alpine.js directives"),
      testids: z.boolean().optional().default(true).describe("Add data-testid attributes"),
      comments: z.boolean().optional().default(true).describe("Add component comments")
    },
    async ({ node_id, format, htmx, alpine, testids, comments }) => {
      try {
        // Get node from Figma
        const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
        const node = result as any;

        if (!node || !node.name) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Node not found" })
            }]
          };
        }

        const lines: string[] = [];
        const requiredComponents = new Set<string>();
        const variables: string[] = [];
        const htmxEndpoints: string[] = [];

        // Recursive template generation
        const processNode = (n: any, indent: number = 0, path: string = ''): void => {
          const spaces = '  '.repeat(indent);
          const nodePath = path ? `${path}/${n.name}` : n.name;
          const { classes, customCss } = extractTailwindFromNode(n);
          const daisyMapping = detectDaisyUIComponent(n.name, path.split('/').pop() || '');

          // Comment for component
          if (comments && daisyMapping) {
            lines.push(`${spaces}<!-- ${daisyMapping.component}: ${daisyMapping.class} -->`);
          }

          // Handle different node types
          if (n.type === 'FRAME' || n.type === 'GROUP') {
            const allClasses = daisyMapping
              ? [daisyMapping.class, ...classes]
              : classes;

            const classStr = allClasses.filter(Boolean).join(' ');
            const testidAttr = testids ? ` data-testid="${generateTestId(nodePath)}"` : '';

            // Style attribute for custom CSS
            const styleAttr = Object.keys(customCss).length
              ? ` style="${Object.entries(customCss).map(([k, v]) => `${k}: ${v}`).join('; ')}"`
              : '';

            lines.push(`${spaces}<div class="${classStr}"${testidAttr}${styleAttr}>`);

            if (n.children) {
              for (const child of n.children) {
                processNode(child, indent + 1, nodePath);
              }
            }

            lines.push(`${spaces}</div>`);
          }

          if (n.type === 'TEXT') {
            const text = n.characters || '';
            const classStr = classes.join(' ');
            const testidAttr = testids ? ` data-testid="${generateTestId(nodePath)}"` : '';

            // Detect if text looks like a variable
            const isVariable = text.match(/^\{\{.*\}\}$/) ||
              text === text.toUpperCase() ||
              text.includes('{{');

            if (isVariable || format === 'jinja') {
              const varName = text.replace(/[{}]/g, '').toLowerCase().replace(/\s+/g, '_');
              if (!variables.includes(varName)) variables.push(varName);
              lines.push(`${spaces}<span class="${classStr}"${testidAttr}>{{ ${varName} }}</span>`);
            } else {
              lines.push(`${spaces}<span class="${classStr}"${testidAttr}>${text}</span>`);
            }
          }

          if (n.type === 'INSTANCE') {
            if (daisyMapping) {
              requiredComponents.add(daisyMapping.component);
              const testidAttr = testids ? ` data-testid="${generateTestId(nodePath)}"` : '';

              // Generate component-specific HTML
              switch (daisyMapping.component) {
                case 'button':
                  const btnHtmx = htmx ? `
${spaces}    hx-post="{{ url_for('${nodePath.toLowerCase().replace(/[^a-z]+/g, '_')}_action') }}"
${spaces}    hx-target="#result"
${spaces}    hx-swap="innerHTML"
${spaces}    hx-indicator=".htmx-indicator"` : '';
                  htmxEndpoints.push(`${nodePath.toLowerCase().replace(/[^a-z]+/g, '_')}_action`);

                  lines.push(`${spaces}<button class="${daisyMapping.class}"${btnHtmx}${testidAttr}>`);
                  lines.push(`${spaces}  {{ button_label | default('Button') }}`);
                  lines.push(`${spaces}</button>`);
                  if (!variables.includes('button_label')) variables.push('button_label');
                  break;

                case 'input':
                  const inputHtmx = htmx ? `
${spaces}    hx-post="{{ url_for('validate_field') }}"
${spaces}    hx-trigger="blur changed delay:500ms"
${spaces}    hx-target="next .error-message"` : '';
                  htmxEndpoints.push('validate_field');

                  lines.push(`${spaces}<input`);
                  lines.push(`${spaces}  type="text"`);
                  lines.push(`${spaces}  class="${daisyMapping.class}"`);
                  lines.push(`${spaces}  name="{{ field_name }}"`);
                  lines.push(`${spaces}  placeholder="{{ placeholder | default('') }}"`);
                  lines.push(`${spaces}  ${inputHtmx.trim()}`);
                  lines.push(`${spaces}  ${testidAttr.trim()}`);
                  lines.push(`${spaces}/>`);
                  if (!variables.includes('field_name')) variables.push('field_name');
                  if (!variables.includes('placeholder')) variables.push('placeholder');
                  break;

                case 'card':
                  lines.push(`${spaces}<div class="${daisyMapping.class}"${testidAttr}>`);
                  lines.push(`${spaces}  <div class="card-body">`);
                  if (n.children) {
                    for (const child of n.children) {
                      processNode(child, indent + 2, nodePath);
                    }
                  }
                  lines.push(`${spaces}  </div>`);
                  lines.push(`${spaces}</div>`);
                  break;

                case 'alert':
                  const alpineAlert = alpine ? ` x-data="{ show: true }" x-show="show" x-transition` : '';
                  lines.push(`${spaces}<div class="${daisyMapping.class}"${alpineAlert}${testidAttr}>`);
                  lines.push(`${spaces}  <span>{{ alert_message }}</span>`);
                  if (alpine) {
                    lines.push(`${spaces}  <button class="btn btn-sm btn-ghost" @click="show = false">×</button>`);
                  }
                  lines.push(`${spaces}</div>`);
                  if (!variables.includes('alert_message')) variables.push('alert_message');
                  break;

                case 'modal':
                  const alpineModal = alpine ? ` x-data="{ open: false }"` : '';
                  lines.push(`${spaces}<dialog class="${daisyMapping.class}"${alpineModal}${testidAttr}>`);
                  lines.push(`${spaces}  <div class="modal-box">`);
                  if (n.children) {
                    for (const child of n.children) {
                      processNode(child, indent + 2, nodePath);
                    }
                  }
                  lines.push(`${spaces}  </div>`);
                  lines.push(`${spaces}  <form method="dialog" class="modal-backdrop">`);
                  lines.push(`${spaces}    <button>close</button>`);
                  lines.push(`${spaces}  </form>`);
                  lines.push(`${spaces}</dialog>`);
                  break;

                case 'stats':
                  lines.push(`${spaces}<div class="${daisyMapping.class}"${testidAttr}>`);
                  lines.push(`${spaces}  {% for stat in stats %}`);
                  lines.push(`${spaces}  <div class="stat">`);
                  lines.push(`${spaces}    <div class="stat-title">{{ stat.title }}</div>`);
                  lines.push(`${spaces}    <div class="stat-value">{{ stat.value }}</div>`);
                  lines.push(`${spaces}    <div class="stat-desc">{{ stat.desc }}</div>`);
                  lines.push(`${spaces}  </div>`);
                  lines.push(`${spaces}  {% endfor %}`);
                  lines.push(`${spaces}</div>`);
                  if (!variables.includes('stats')) variables.push('stats');
                  break;

                default:
                  // Generic component
                  lines.push(`${spaces}<div class="${daisyMapping.class}"${testidAttr}>`);
                  if (n.children) {
                    for (const child of n.children) {
                      processNode(child, indent + 1, nodePath);
                    }
                  }
                  lines.push(`${spaces}</div>`);
              }
            } else {
              // Unknown instance - just process children
              if (n.children) {
                for (const child of n.children) {
                  processNode(child, indent, nodePath);
                }
              }
            }
          }
        };

        // Start processing
        processNode(node, 0, '');

        // Wrap in Jinja extends if format is jinja
        let template = '';
        if (format === 'jinja') {
          template = `{% extends "base.html" %}

{% block title %}${node.name}{% endblock %}

{% block content %}
${lines.join('\n')}
{% endblock %}

{% block scripts %}
${alpine ? `<script>
  document.addEventListener('alpine:init', () => {
    Alpine.data('page', () => ({
      // Page state
    }))
  })
</script>` : '<!-- No additional scripts needed -->'}
{% endblock %}
`;
        } else {
          template = lines.join('\n');
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              node_name: node.name,
              node_id: node_id,
              format,
              template,
              required_components: Array.from(requiredComponents),
              variables,
              htmx_endpoints: htmx ? [...new Set(htmxEndpoints)] : []
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error generating template: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  /**
   * Extract Tailwind classes from a node
   */
  server.tool(
    "extract_tailwind",
    "Extract Tailwind CSS classes from Figma node styles. Converts Figma properties to Tailwind utilities.",
    {
      node_id: z.string().describe("Figma node ID")
    },
    async ({ node_id }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
        const node = result as any;

        if (!node) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Node not found" })
            }]
          };
        }

        const { classes, customCss } = extractTailwindFromNode(node);
        const daisyMapping = detectDaisyUIComponent(node.name, '');

        const warnings: string[] = [];
        if (Object.keys(customCss).length > 0) {
          warnings.push(`${Object.keys(customCss).length} styles could not be mapped to Tailwind`);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              node_name: node.name,
              node_type: node.type,
              daisyui: daisyMapping,
              tailwind_classes: classes,
              custom_css: customCss,
              warnings,
              combined_class: daisyMapping
                ? `${daisyMapping.class} ${classes.join(' ')}`
                : classes.join(' ')
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
   * Generate Page Object for E2E testing
   */
  server.tool(
    "generate_page_object",
    "Generate a Page Object class for E2E testing from a Figma page. Supports Playwright (TypeScript/Python).",
    {
      page: z.string().describe("Page name or ID"),
      framework: z.enum(["playwright"]).optional().default("playwright").describe("Testing framework"),
      language: z.enum(["typescript", "python"]).optional().default("typescript").describe("Output language")
    },
    async ({ page, framework, language }) => {
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

        // Get nodes with test IDs
        const nodes = cache.getNodesByType('FRAME', targetPage.id, 500)
          .concat(cache.getNodesByType('INSTANCE', targetPage.id, 500))
          .filter(n => n.data_testid);

        // Generate class name from page name
        const className = targetPage.name
          .replace(/[^a-zA-Z0-9]+/g, '')
          .replace(/^[a-z]/, c => c.toUpperCase()) + 'Page';

        let code = '';

        if (language === 'typescript') {
          code = `import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for ${targetPage.name}
 * Generated from Figma design
 */
export class ${className} {
  readonly page: Page;

  // Locators
${nodes.map(n => `  readonly ${n.data_testid!.replace(/-/g, '_')}: Locator;`).join('\n')}

  constructor(page: Page) {
    this.page = page;
${nodes.map(n => `    this.${n.data_testid!.replace(/-/g, '_')} = page.getByTestId('${n.data_testid}');`).join('\n')}
  }

  async goto() {
    await this.page.goto('/${targetPage.name.toLowerCase().replace(/\s+/g, '-')}');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

${nodes.filter(n => n.daisyui_component === 'button').map(n => `
  async click${n.name.replace(/[^a-zA-Z0-9]+/g, '')}() {
    await this.${n.data_testid!.replace(/-/g, '_')}.click();
  }`).join('\n')}

${nodes.filter(n => n.daisyui_component === 'input').map(n => `
  async fill${n.name.replace(/[^a-zA-Z0-9]+/g, '')}(value: string) {
    await this.${n.data_testid!.replace(/-/g, '_')}.fill(value);
  }`).join('\n')}
}
`;
        } else {
          // Python
          code = `from playwright.sync_api import Page, Locator, expect


class ${className}:
    """
    Page Object for ${targetPage.name}
    Generated from Figma design
    """

    def __init__(self, page: Page):
        self.page = page
${nodes.map(n => `        self.${n.data_testid!.replace(/-/g, '_')} = page.get_by_test_id("${n.data_testid}")`).join('\n')}

    def goto(self):
        self.page.goto("/${targetPage.name.toLowerCase().replace(/\s+/g, '-')}")

    def wait_for_load(self):
        self.page.wait_for_load_state("networkidle")

${nodes.filter(n => n.daisyui_component === 'button').map(n => `
    def click_${n.data_testid!.replace(/-/g, '_')}(self):
        self.${n.data_testid!.replace(/-/g, '_')}.click()`).join('\n')}

${nodes.filter(n => n.daisyui_component === 'input').map(n => `
    def fill_${n.data_testid!.replace(/-/g, '_')}(self, value: str):
        self.${n.data_testid!.replace(/-/g, '_')}.fill(value)`).join('\n')}
`;
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              page_name: targetPage.name,
              class_name: className,
              framework,
              language,
              locator_count: nodes.length,
              code
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
   * Generate component registry YAML entry
   */
  server.tool(
    "generate_registry_entry",
    "Generate a component registry YAML entry from a Figma node. For use with component-registry workflows.",
    {
      node_id: z.string().describe("Figma node ID"),
      page_name: z.string().describe("Page name for the registry entry")
    },
    async ({ node_id, page_name }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
        const node = result as any;

        if (!node) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Node not found" })
            }]
          };
        }

        const daisyMapping = detectDaisyUIComponent(node.name, '');
        const { classes } = extractTailwindFromNode(node);
        const testId = generateTestId(node.name);

        const yamlOutput = `# ${page_name} - ${node.name}
${page_name.toLowerCase().replace(/\s+/g, '_')}:
  ${testId.replace(/-/g, '_')}:
    figma_id: "${node_id}"
    name: "${node.name}"
    type: "${node.type}"
    daisyui:
      component: "${daisyMapping?.component || 'custom'}"
      class: "${daisyMapping?.class || classes.join(' ')}"
      variant: "${daisyMapping?.variant || ''}"
      size: "${daisyMapping?.size || ''}"
    tailwind: "${classes.join(' ')}"
    data_testid: "${testId}"
    template: |
      <div class="${daisyMapping?.class || classes.join(' ')}" data-testid="${testId}">
        <!-- Content -->
      </div>
`;

        return {
          content: [{
            type: "text",
            text: yamlOutput
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

  // ============================================================================
  // DESIGN TOKEN EXTRACTION
  // ============================================================================

  /**
   * Extract design tokens from Figma document
   */
  server.tool(
    "extract_design_tokens",
    "Extract design tokens (colors, spacing, typography, radii, shadows) from a Figma frame or entire document. Generates Tailwind config compatible output.",
    {
      node_id: z.string().optional().describe("Specific node ID to extract from (uses entire document if not specified)"),
      output_format: z.enum(["json", "tailwind", "css_vars"]).optional().default("json").describe("Output format")
    },
    async ({ node_id, output_format }) => {
      try {
        cache.initialize();

        const tokens: {
          colors: Record<string, string>;
          spacing: number[];
          fontSizes: number[];
          fontWeights: number[];
          fontFamilies: string[];
          borderRadii: number[];
          shadows: { blur: number; spread?: number; offsetX?: number; offsetY?: number; color?: string }[];
        } = {
          colors: {},
          spacing: [],
          fontSizes: [],
          fontWeights: [],
          fontFamilies: [],
          borderRadii: [],
          shadows: []
        };

        // Get nodes to analyze
        let nodes: any[];
        if (node_id) {
          const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
          nodes = [result];
        } else {
          // Get all nodes from cache
          nodes = cache.getAllNodes();
        }

        // Extract tokens from nodes recursively
        const processNode = (node: any) => {
          if (!node) return;

          // Colors from fills
          if (node.fills?.length > 0) {
            for (const fill of node.fills) {
              if (fill.type === 'SOLID' && fill.visible !== false && fill.color) {
                const hex = rgbToHex(fill.color);
                const daisyMatch = matchDaisyUIColor(hex);
                if (!daisyMatch) {
                  // Custom color - add to tokens
                  const name = node.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'color';
                  tokens.colors[`${name}-fill`] = hex;
                }
              }
            }
          }

          // Colors from strokes
          if (node.strokes?.length > 0) {
            for (const stroke of node.strokes) {
              if (stroke.type === 'SOLID' && stroke.visible !== false && stroke.color) {
                const hex = rgbToHex(stroke.color);
                const daisyMatch = matchDaisyUIColor(hex);
                if (!daisyMatch) {
                  const name = node.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'color';
                  tokens.colors[`${name}-stroke`] = hex;
                }
              }
            }
          }

          // Spacing from padding and gaps
          const spacingValues = [
            node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom,
            node.itemSpacing
          ].filter(v => typeof v === 'number' && v > 0);
          tokens.spacing.push(...spacingValues);

          // Typography
          if (node.type === 'TEXT') {
            if (node.fontSize && !tokens.fontSizes.includes(node.fontSize)) {
              tokens.fontSizes.push(node.fontSize);
            }
            if (node.fontWeight && !tokens.fontWeights.includes(node.fontWeight)) {
              tokens.fontWeights.push(node.fontWeight);
            }
            if (node.fontName?.family && !tokens.fontFamilies.includes(node.fontName.family)) {
              tokens.fontFamilies.push(node.fontName.family);
            }
          }

          // Border radius
          if (node.cornerRadius && !tokens.borderRadii.includes(node.cornerRadius)) {
            tokens.borderRadii.push(node.cornerRadius);
          }

          // Effects (shadows)
          if (node.effects?.length > 0) {
            for (const effect of node.effects) {
              if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.visible !== false) {
                tokens.shadows.push({
                  blur: effect.radius || 0,
                  spread: effect.spread || 0,
                  offsetX: effect.offset?.x || 0,
                  offsetY: effect.offset?.y || 0,
                  color: effect.color ? rgbToHex(effect.color) : undefined
                });
              }
            }
          }

          // Process children
          if (node.children) {
            for (const child of node.children) {
              processNode(child);
            }
          }
        };

        for (const node of nodes) {
          processNode(node);
        }

        // Deduplicate and sort
        tokens.spacing = [...new Set(tokens.spacing)].sort((a, b) => a - b);
        tokens.fontSizes = [...new Set(tokens.fontSizes)].sort((a, b) => a - b);
        tokens.fontWeights = [...new Set(tokens.fontWeights)].sort((a, b) => a - b);
        tokens.borderRadii = [...new Set(tokens.borderRadii)].sort((a, b) => a - b);

        // Format output
        let output: string;
        if (output_format === 'tailwind') {
          output = `// Generated Tailwind config extension
// Add to tailwind.config.js theme.extend

module.exports = {
  theme: {
    extend: {
      colors: {
${Object.entries(tokens.colors).map(([name, hex]) => `        '${name}': '${hex}',`).join('\n')}
      },
      spacing: {
${tokens.spacing.filter(s => !TAILWIND_SPACING[s]).map(s => `        '${s}': '${s}px',`).join('\n')}
      },
      fontSize: {
${tokens.fontSizes.filter(s => !TAILWIND_FONT_SIZES[s]).map(s => `        '${s}': '${s}px',`).join('\n')}
      },
      borderRadius: {
${tokens.borderRadii.filter(r => r > 0 && r !== 2 && r !== 4 && r !== 6 && r !== 8 && r !== 12 && r !== 16 && r !== 24).map(r => `        '${r}': '${r}px',`).join('\n')}
      },
      fontFamily: {
${tokens.fontFamilies.map(f => `        '${f.toLowerCase().replace(/\s+/g, '-')}': ['${f}', 'sans-serif'],`).join('\n')}
      },
    }
  }
}`;
        } else if (output_format === 'css_vars') {
          output = `:root {
  /* Colors */
${Object.entries(tokens.colors).map(([name, hex]) => `  --color-${name}: ${hex};`).join('\n')}

  /* Spacing */
${tokens.spacing.map(s => `  --spacing-${s}: ${s}px;`).join('\n')}

  /* Font Sizes */
${tokens.fontSizes.map(s => `  --font-size-${s}: ${s}px;`).join('\n')}

  /* Border Radii */
${tokens.borderRadii.map(r => `  --radius-${r}: ${r}px;`).join('\n')}

  /* Font Families */
${tokens.fontFamilies.map((f, i) => `  --font-family-${i + 1}: '${f}', sans-serif;`).join('\n')}
}`;
        } else {
          output = JSON.stringify({
            extracted_tokens: tokens,
            stats: {
              unique_colors: Object.keys(tokens.colors).length,
              unique_spacing: tokens.spacing.length,
              unique_font_sizes: tokens.fontSizes.length,
              unique_font_weights: tokens.fontWeights.length,
              unique_font_families: tokens.fontFamilies.length,
              unique_border_radii: tokens.borderRadii.length,
              shadow_styles: tokens.shadows.length
            },
            daisyui_coverage: {
              note: "Colors matching DaisyUI palette were excluded as they're already available"
            }
          }, null, 2);
        }

        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error extracting tokens: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // ============================================================================
  // i18n TEXT EXTRACTION
  // ============================================================================

  /**
   * Extract text content for i18n validation
   */
  server.tool(
    "extract_text_nodes",
    "Extract all text content from a Figma frame for i18n validation. Groups by suggested namespace and detects potential translation issues.",
    {
      node_id: z.string().describe("Frame node ID to extract text from"),
      suggested_namespace: z.string().optional().describe("Suggested i18n namespace (e.g., 'dashboard', 'auth')"),
      detect_variables: z.boolean().optional().default(true).describe("Detect Jinja-style variables in text")
    },
    async ({ node_id, suggested_namespace, detect_variables }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
        const node = result as any;

        if (!node) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Node not found" })
            }]
          };
        }

        const textNodes: {
          id: string;
          name: string;
          path: string;
          text: string;
          suggested_key: string;
          has_variables: boolean;
          variables: string[];
          font_size: number;
          is_heading: boolean;
          word_count: number;
        }[] = [];

        const processNode = (n: any, path: string = '') => {
          const currentPath = path ? `${path} > ${n.name}` : n.name;

          if (n.type === 'TEXT' && n.characters) {
            const text = n.characters.trim();
            if (text.length > 0) {
              // Detect variables like {{ variable }} or {variable}
              const variablePattern = /\{\{?\s*(\w+)\s*\}?\}/g;
              const variables: string[] = [];
              let match;
              while ((match = variablePattern.exec(text)) !== null) {
                variables.push(match[1]);
              }

              // Generate suggested key
              const suggestedKey = text
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .trim()
                .replace(/\s+/g, '_')
                .substring(0, 30);

              // Detect if it's likely a heading
              const isHeading = (n.fontSize && n.fontSize >= 20) ||
                n.name.toLowerCase().includes('title') ||
                n.name.toLowerCase().includes('heading') ||
                n.name.toLowerCase().includes('header');

              textNodes.push({
                id: n.id,
                name: n.name,
                path: currentPath,
                text: text,
                suggested_key: suggested_namespace
                  ? `${suggested_namespace}.${suggestedKey}`
                  : suggestedKey,
                has_variables: detect_variables && variables.length > 0,
                variables: detect_variables ? variables : [],
                font_size: n.fontSize || 14,
                is_heading: isHeading,
                word_count: text.split(/\s+/).length
              });
            }
          }

          if (n.children) {
            for (const child of n.children) {
              processNode(child, currentPath);
            }
          }
        };

        processNode(node);

        // Sort by path for logical grouping
        textNodes.sort((a, b) => a.path.localeCompare(b.path));

        // Detect potential issues
        const issues: string[] = [];

        // Check for hardcoded dates/numbers
        const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
        const currencyPattern = /\$|€|£|kr|NOK/i;

        for (const node of textNodes) {
          if (datePattern.test(node.text)) {
            issues.push(`Hardcoded date in "${node.name}": ${node.text}`);
          }
          if (currencyPattern.test(node.text) && !node.has_variables) {
            issues.push(`Hardcoded currency in "${node.name}": ${node.text} - consider using i18n number formatting`);
          }
          if (node.text.length > 100 && !node.has_variables) {
            issues.push(`Long text in "${node.name}" may need review for translation length differences`);
          }
        }

        // Generate i18n YAML snippet
        const yamlSnippet = `${suggested_namespace || 'page'}:
${textNodes.map(n => `  ${n.suggested_key.split('.').pop()}: "${n.text.replace(/"/g, '\\"')}"`).join('\n')}
`;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              frame_name: node.name,
              suggested_namespace,
              text_count: textNodes.length,
              total_words: textNodes.reduce((sum, n) => sum + n.word_count, 0),
              headings: textNodes.filter(n => n.is_heading).length,
              with_variables: textNodes.filter(n => n.has_variables).length,
              issues,
              texts: textNodes,
              i18n_yaml_snippet: yamlSnippet
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error extracting text: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // ============================================================================
  // ACCESSIBILITY AUDIT
  // ============================================================================

  /**
   * Audit accessibility of a Figma frame
   */
  server.tool(
    "audit_accessibility",
    "Audit a Figma frame for WCAG 2.1 AA accessibility issues. Checks contrast ratios, touch target sizes, text sizes, and more.",
    {
      node_id: z.string().describe("Frame node ID to audit"),
      strict: z.boolean().optional().default(false).describe("Use stricter AAA guidelines instead of AA")
    },
    async ({ node_id, strict }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId: node_id });
        const node = result as any;

        if (!node) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: "Node not found" })
            }]
          };
        }

        const contrastThreshold = strict ? 7.0 : WCAG_CONTRAST_AA_NORMAL;
        const largeTextThreshold = strict ? 4.5 : WCAG_CONTRAST_AA_LARGE;
        const minTouchTarget = WCAG_MIN_TOUCH_TARGET;

        const issues: {
          severity: 'error' | 'warning' | 'info';
          type: string;
          element: string;
          path: string;
          message: string;
          value?: string | number;
          expected?: string | number;
        }[] = [];

        const stats = {
          elements_checked: 0,
          text_nodes: 0,
          interactive_elements: 0,
          contrast_issues: 0,
          touch_target_issues: 0,
          text_size_issues: 0
        };

        // Track parent background colors for contrast calculation
        const getBackgroundColor = (n: any): string | null => {
          if (n.fills?.length > 0) {
            const solidFill = n.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
            if (solidFill?.color) {
              return rgbToHex(solidFill.color);
            }
          }
          return null;
        };

        const processNode = (n: any, path: string = '', parentBg: string = '#ffffff') => {
          stats.elements_checked++;
          const currentPath = path ? `${path} > ${n.name}` : n.name;
          const currentBg = getBackgroundColor(n) || parentBg;

          // Check text contrast
          if (n.type === 'TEXT') {
            stats.text_nodes++;
            const textColor = n.fills?.find((f: any) => f.type === 'SOLID' && f.visible !== false);
            if (textColor?.color) {
              const textHex = rgbToHex(textColor.color);
              const contrast = getContrastRatio(textHex, parentBg);
              const isLargeText = n.fontSize >= 18 || (n.fontSize >= 14 && n.fontWeight >= 700);
              const requiredContrast = isLargeText ? largeTextThreshold : contrastThreshold;

              if (contrast < requiredContrast) {
                stats.contrast_issues++;
                issues.push({
                  severity: contrast < 3.0 ? 'error' : 'warning',
                  type: 'contrast',
                  element: n.name,
                  path: currentPath,
                  message: `Insufficient contrast ratio: ${contrast.toFixed(2)}:1 (${isLargeText ? 'large' : 'normal'} text requires ${requiredContrast}:1)`,
                  value: contrast.toFixed(2),
                  expected: requiredContrast
                });
              }
            }

            // Check minimum text size
            if (n.fontSize < 12) {
              stats.text_size_issues++;
              issues.push({
                severity: n.fontSize < 10 ? 'error' : 'warning',
                type: 'text_size',
                element: n.name,
                path: currentPath,
                message: `Text size ${n.fontSize}px is below recommended minimum of 12px`,
                value: n.fontSize,
                expected: 12
              });
            }
          }

          // Check interactive element sizes (buttons, inputs, etc.)
          const isInteractive =
            n.name.toLowerCase().includes('button') ||
            n.name.toLowerCase().includes('btn') ||
            n.name.toLowerCase().includes('input') ||
            n.name.toLowerCase().includes('link') ||
            n.name.toLowerCase().includes('checkbox') ||
            n.name.toLowerCase().includes('radio') ||
            n.name.toLowerCase().includes('switch') ||
            n.name.toLowerCase().includes('toggle') ||
            (n.type === 'INSTANCE' && detectDaisyUIComponent(n.name, '')?.component === 'button');

          if (isInteractive) {
            stats.interactive_elements++;
            const width = n.width || n.absoluteBoundingBox?.width || 0;
            const height = n.height || n.absoluteBoundingBox?.height || 0;

            if (width < minTouchTarget || height < minTouchTarget) {
              stats.touch_target_issues++;
              issues.push({
                severity: Math.min(width, height) < 32 ? 'error' : 'warning',
                type: 'touch_target',
                element: n.name,
                path: currentPath,
                message: `Touch target ${width}x${height}px is below minimum ${minTouchTarget}x${minTouchTarget}px`,
                value: `${width}x${height}`,
                expected: `${minTouchTarget}x${minTouchTarget}`
              });
            }
          }

          // Check for missing text alternatives (images without nearby text labels)
          if (n.type === 'RECTANGLE' || n.type === 'ELLIPSE' || n.type === 'POLYGON') {
            const hasFillImage = n.fills?.some((f: any) => f.type === 'IMAGE');
            if (hasFillImage) {
              const hasAltText = n.name && !n.name.match(/^(image|img|rectangle|ellipse|shape)/i);
              if (!hasAltText) {
                issues.push({
                  severity: 'warning',
                  type: 'alt_text',
                  element: n.name,
                  path: currentPath,
                  message: 'Image may need descriptive name for accessibility'
                });
              }
            }
          }

          // Process children
          if (n.children) {
            for (const child of n.children) {
              processNode(child, currentPath, currentBg);
            }
          }
        };

        processNode(node);

        // Sort issues by severity
        issues.sort((a, b) => {
          const severityOrder = { error: 0, warning: 1, info: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        });

        const passedChecks = stats.elements_checked -
          stats.contrast_issues - stats.touch_target_issues - stats.text_size_issues;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              frame_name: node.name,
              wcag_level: strict ? 'AAA' : 'AA',
              summary: {
                total_elements: stats.elements_checked,
                text_nodes: stats.text_nodes,
                interactive_elements: stats.interactive_elements,
                issues_found: issues.length,
                passed_checks: passedChecks,
                pass_rate: `${((passedChecks / stats.elements_checked) * 100).toFixed(1)}%`
              },
              breakdown: {
                contrast_issues: stats.contrast_issues,
                touch_target_issues: stats.touch_target_issues,
                text_size_issues: stats.text_size_issues
              },
              issues
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error auditing accessibility: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // ============================================================================
  // COMPONENT REGISTRY SYNC
  // ============================================================================

  /**
   * Sync Figma components with local component registry
   */
  server.tool(
    "sync_component_registry",
    "Compare Figma components with local component-registry YAML files. Detects drift, missing components, and generates sync reports.",
    {
      registry_path: z.string().describe("Path to component-registry directory (e.g., /path/to/docs/ui/component-registry)"),
      page_name: z.string().optional().describe("Specific page to sync (e.g., 'dashboard', 'login')"),
      update_registry: z.boolean().optional().default(false).describe("Update registry files with Figma changes")
    },
    async ({ registry_path, page_name, update_registry }) => {
      try {
        cache.initialize();

        // Check if registry path exists
        if (!fs.existsSync(registry_path)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: `Registry path not found: ${registry_path}` })
            }]
          };
        }

        const syncReport: {
          pages_checked: string[];
          components_in_figma: number;
          components_in_registry: number;
          matching: { name: string; figma_id: string; status: string }[];
          missing_from_registry: { name: string; figma_id: string; type: string; daisyui?: string }[];
          missing_from_figma: { name: string; registry_id: string }[];
          drift_detected: { name: string; field: string; figma_value: string; registry_value: string }[];
          updates_applied: string[];
        } = {
          pages_checked: [],
          components_in_figma: 0,
          components_in_registry: 0,
          matching: [],
          missing_from_registry: [],
          missing_from_figma: [],
          drift_detected: [],
          updates_applied: []
        };

        // Get Figma pages and components
        const figmaPages = cache.getPages();
        const targetPages = page_name
          ? figmaPages.filter(p => p.name.toLowerCase().includes(page_name.toLowerCase()))
          : figmaPages;

        for (const page of targetPages) {
          syncReport.pages_checked.push(page.name);

          // Get components from this page
          const pageComponents = cache.searchNodes(page.name, 50)
            .filter(n => n.type === 'INSTANCE' || n.daisyui_component);

          syncReport.components_in_figma += pageComponents.length;

          // Try to find corresponding registry file
          const registryFileName = page.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.yaml';
          const possiblePaths = [
            path.join(registry_path, 'pages', registryFileName),
            path.join(registry_path, registryFileName)
          ];

          let registryFile: string | null = null;
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              registryFile = p;
              break;
            }
          }

          if (registryFile) {
            const registryContent = fs.readFileSync(registryFile, 'utf-8');
            const registryData = yaml.parse(registryContent) as Record<string, any>;

            // Extract component entries from registry
            const extractComponents = (obj: any, prefix = ''): { id: string; data: any }[] => {
              const results: { id: string; data: any }[] = [];
              for (const [key, value] of Object.entries(obj || {})) {
                if (value && typeof value === 'object') {
                  if (value.figma_id || value.test_id) {
                    results.push({ id: prefix ? `${prefix}.${key}` : key, data: value });
                  }
                  results.push(...extractComponents(value, prefix ? `${prefix}.${key}` : key));
                }
              }
              return results;
            };

            const registryComponents = extractComponents(registryData);
            syncReport.components_in_registry += registryComponents.length;

            // Compare
            for (const figmaComp of pageComponents) {
              const registryMatch = registryComponents.find(
                rc => rc.data.figma_id === figmaComp.id ||
                  rc.data.test_id === figmaComp.data_testid ||
                  rc.id.toLowerCase().includes(figmaComp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
              );

              if (registryMatch) {
                syncReport.matching.push({
                  name: figmaComp.name,
                  figma_id: figmaComp.id,
                  status: 'synced'
                });

                // Check for drift
                if (registryMatch.data.daisyui?.component !== figmaComp.daisyui_component && figmaComp.daisyui_component) {
                  syncReport.drift_detected.push({
                    name: figmaComp.name,
                    field: 'daisyui_component',
                    figma_value: figmaComp.daisyui_component || 'none',
                    registry_value: registryMatch.data.daisyui?.component || 'none'
                  });
                }
              } else {
                syncReport.missing_from_registry.push({
                  name: figmaComp.name,
                  figma_id: figmaComp.id,
                  type: figmaComp.type,
                  daisyui: figmaComp.daisyui_component || undefined
                });
              }
            }

            // Check for registry entries missing from Figma
            for (const regComp of registryComponents) {
              if (regComp.data.figma_id) {
                const figmaMatch = pageComponents.find(fc => fc.id === regComp.data.figma_id);
                if (!figmaMatch) {
                  syncReport.missing_from_figma.push({
                    name: regComp.id,
                    registry_id: regComp.data.figma_id
                  });
                }
              }
            }

            // Update registry if requested
            if (update_registry && syncReport.missing_from_registry.length > 0) {
              // Add new components to registry
              let updatedContent = registryContent;
              for (const missing of syncReport.missing_from_registry) {
                const newEntry = `
  ${missing.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}:
    figma_id: "${missing.figma_id}"
    type: "${missing.type}"
    ${missing.daisyui ? `daisyui:\n      component: "${missing.daisyui}"` : ''}
    data_testid: "${generateTestId(missing.name)}"
    status: auto_generated
`;
                updatedContent += newEntry;
                syncReport.updates_applied.push(`Added ${missing.name} to registry`);
              }

              fs.writeFileSync(registryFile, updatedContent);
            }
          } else {
            // No registry file found - all components are "missing"
            for (const figmaComp of pageComponents) {
              syncReport.missing_from_registry.push({
                name: figmaComp.name,
                figma_id: figmaComp.id,
                type: figmaComp.type,
                daisyui: figmaComp.daisyui_component || undefined
              });
            }
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              sync_report: syncReport,
              summary: {
                sync_status: syncReport.drift_detected.length === 0 &&
                  syncReport.missing_from_registry.length === 0 &&
                  syncReport.missing_from_figma.length === 0 ? 'in_sync' : 'drift_detected',
                action_required: syncReport.missing_from_registry.length > 0 ||
                  syncReport.drift_detected.length > 0
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error syncing registry: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // ============================================================================
  // VISUAL COMPARISON (for regression testing)
  // ============================================================================

  /**
   * Export Figma frame for visual comparison
   */
  server.tool(
    "export_for_comparison",
    "Export a Figma frame as an image for visual regression testing. Returns base64 image data that can be compared with Playwright screenshots.",
    {
      node_id: z.string().describe("Frame node ID to export"),
      format: z.enum(["PNG", "JPG"]).optional().default("PNG").describe("Image format"),
      scale: z.number().optional().default(1).describe("Export scale (1 = 1x, 2 = 2x for retina)")
    },
    async ({ node_id, format, scale }) => {
      try {
        const result = await sendCommandToFigma("export_node_as_image", {
          nodeId: node_id,
          format,
          scale
        });

        const exportResult = result as any;

        if (!exportResult || exportResult.error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ error: exportResult?.error || "Export failed" })
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              node_id,
              format,
              scale,
              image_data: exportResult.imageData,
              dimensions: {
                width: exportResult.width,
                height: exportResult.height
              },
              usage_hint: "Use this base64 data with Playwright's toHaveScreenshot() or save to file for comparison"
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error exporting: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

}
