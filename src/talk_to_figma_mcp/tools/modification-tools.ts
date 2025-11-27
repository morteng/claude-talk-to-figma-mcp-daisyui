import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../utils/websocket";
import { applyColorDefaults, applyDefault, FIGMA_DEFAULTS } from "../utils/defaults";
import { Color } from "../types/color";

/**
 * Register modification tools to the MCP server
 * This module contains tools for modifying existing elements in Figma
 * @param server - The MCP server instance
 */
export function registerModificationTools(server: McpServer): void {
  // Set Fill Color Tool
  server.tool(
    "set_fill_color",
    "Set the fill color of a node in Figma. Alpha component defaults to 1 (fully opaque) if not specified. Use alpha 0 for fully transparent.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      r: z.number().min(0).max(1).describe("Red component (0-1)"),
      g: z.number().min(0).max(1).describe("Green component (0-1)"),
      b: z.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha component (0-1, defaults to 1 if not specified)"),
    },
    async ({ nodeId, r, g, b, a }) => {
      try {
        // Additional validation: Ensure RGB values are provided (they should not be undefined)
        if (r === undefined || g === undefined || b === undefined) {
          throw new Error("RGB components (r, g, b) are required and cannot be undefined");
        }
        
        // Apply default values safely - preserves opacity 0 for transparency
        const colorInput: Color = { r, g, b, a };
        const colorWithDefaults = applyColorDefaults(colorInput);
        
        const result = await sendCommandToFigma("set_fill_color", {
          nodeId,
          color: colorWithDefaults,
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Set fill color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${colorWithDefaults.a})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Set Stroke Color Tool
  server.tool(
    "set_stroke_color",
    "Set the stroke color of a node in Figma (defaults: opacity 1, weight 1)",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      r: z.number().min(0).max(1).describe("Red component (0-1)"),
      g: z.number().min(0).max(1).describe("Green component (0-1)"),
      b: z.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
      strokeWeight: z.number().min(0).optional().describe("Stroke weight >= 0)"),
    },
    async ({ nodeId, r, g, b, a, strokeWeight }) => {
      try {

        if (r === undefined || g === undefined || b === undefined) {
          throw new Error("RGB components (r, g, b) are required and cannot be undefined");
        }
        
        const colorInput: Color = { r, g, b, a };
        const colorWithDefaults = applyColorDefaults(colorInput);
        
        const strokeWeightWithDefault = applyDefault(strokeWeight, FIGMA_DEFAULTS.stroke.weight);
        
        const result = await sendCommandToFigma("set_stroke_color", {
          nodeId,
          color: colorWithDefaults,
          strokeWeight: strokeWeightWithDefault,
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Set stroke color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${colorWithDefaults.a}) with weight ${strokeWeightWithDefault}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Move Node Tool
  server.tool(
    "move_node",
    "Move a node to a new position in Figma",
    {
      nodeId: z.string().describe("The ID of the node to move"),
      x: z.number().describe("New X position"),
      y: z.number().describe("New Y position"),
    },
    async ({ nodeId, x, y }) => {
      try {
        const result = await sendCommandToFigma("move_node", { nodeId, x, y });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Moved node "${typedResult.name}" to position (${x}, ${y})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error moving node: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Resize Node Tool
  server.tool(
    "resize_node",
    "Resize a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to resize"),
      width: z.number().positive().describe("New width"),
      height: z.number().positive().describe("New height"),
    },
    async ({ nodeId, width, height }) => {
      try {
        const result = await sendCommandToFigma("resize_node", {
          nodeId,
          width,
          height,
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Resized node "${typedResult.name}" to width ${width} and height ${height}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error resizing node: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Delete Node Tool
  server.tool(
    "delete_node",
    "Delete a node from Figma",
    {
      nodeId: z.string().describe("The ID of the node to delete"),
    },
    async ({ nodeId }) => {
      try {
        await sendCommandToFigma("delete_node", { nodeId });
        return {
          content: [
            {
              type: "text",
              text: `Deleted node with ID: ${nodeId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Set Corner Radius Tool
  server.tool(
    "set_corner_radius",
    "Set the corner radius of a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      radius: z.number().min(0).describe("Corner radius value"),
      corners: z
        .array(z.boolean())
        .length(4)
        .optional()
        .describe(
          "Optional array of 4 booleans to specify which corners to round [topLeft, topRight, bottomRight, bottomLeft]"
        ),
    },
    async ({ nodeId, radius, corners }) => {
      try {
        const result = await sendCommandToFigma("set_corner_radius", {
          nodeId,
          radius,
          corners: corners || [true, true, true, true],
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Set corner radius of node "${typedResult.name}" to ${radius}px`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Auto Layout Tool
  server.tool(
    "set_auto_layout",
    "Configure auto layout properties for a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to configure auto layout"),
      layoutMode: z.enum(["HORIZONTAL", "VERTICAL", "NONE"]).describe("Layout direction"),
      paddingTop: z.number().optional().describe("Top padding in pixels"),
      paddingBottom: z.number().optional().describe("Bottom padding in pixels"),
      paddingLeft: z.number().optional().describe("Left padding in pixels"),
      paddingRight: z.number().optional().describe("Right padding in pixels"),
      itemSpacing: z.number().optional().describe("Spacing between items in pixels"),
      primaryAxisAlignItems: z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"]).optional().describe("Alignment along primary axis"),
      counterAxisAlignItems: z.enum(["MIN", "CENTER", "MAX"]).optional().describe("Alignment along counter axis"),
      layoutWrap: z.enum(["WRAP", "NO_WRAP"]).optional().describe("Whether items wrap to new lines"),
      strokesIncludedInLayout: z.boolean().optional().describe("Whether strokes are included in layout calculations")
    },
    async ({ nodeId, layoutMode, paddingTop, paddingBottom, paddingLeft, paddingRight, 
             itemSpacing, primaryAxisAlignItems, counterAxisAlignItems, layoutWrap, strokesIncludedInLayout }) => {
      try {
        const result = await sendCommandToFigma("set_auto_layout", { 
          nodeId, 
          layoutMode, 
          paddingTop, 
          paddingBottom, 
          paddingLeft, 
          paddingRight, 
          itemSpacing, 
          primaryAxisAlignItems, 
          counterAxisAlignItems, 
          layoutWrap, 
          strokesIncludedInLayout 
        });
        
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Applied auto layout to node "${typedResult.name}" with mode: ${layoutMode}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting auto layout: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Effects Tool
  server.tool(
    "set_effects",
    "Set the visual effects of a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      effects: z.array(
        z.object({
          type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
          color: z.object({
            r: z.number().min(0).max(1).describe("Red (0-1)"),
            g: z.number().min(0).max(1).describe("Green (0-1)"),
            b: z.number().min(0).max(1).describe("Blue (0-1)"),
            a: z.number().min(0).max(1).describe("Alpha (0-1)")
          }).optional().describe("Effect color (for shadows)"),
          offset: z.object({
            x: z.number().describe("X offset"),
            y: z.number().describe("Y offset")
          }).optional().describe("Offset (for shadows)"),
          radius: z.number().optional().describe("Effect radius"),
          spread: z.number().optional().describe("Shadow spread (for shadows)"),
          visible: z.boolean().optional().describe("Whether the effect is visible"),
          blendMode: z.string().optional().describe("Blend mode")
        })
      ).describe("Array of effects to apply")
    },
    async ({ nodeId, effects }) => {
      try {
        const result = await sendCommandToFigma("set_effects", {
          nodeId,
          effects
        });
        
        const typedResult = result as { name: string, effects: any[] };
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully applied ${effects.length} effect(s) to node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting effects: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Effect Style ID Tool
  server.tool(
    "set_effect_style_id",
    "Apply an effect style to a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      effectStyleId: z.string().describe("The ID of the effect style to apply")
    },
    async ({ nodeId, effectStyleId }) => {
      try {
        const result = await sendCommandToFigma("set_effect_style_id", {
          nodeId,
          effectStyleId
        });

        const typedResult = result as { name: string, effectStyleId: string };

        return {
          content: [
            {
              type: "text",
              text: `Successfully applied effect style to node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting effect style: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // ==========================================================================
  // FIGMA VARIABLES & STYLE BINDING TOOLS
  // ==========================================================================

  // Get Local Variables Tool
  server.tool(
    "get_local_variables",
    "Get all local variables (design tokens) from the Figma document. Returns color, number, string, and boolean variables organized by collection.",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_local_variables", {});
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting local variables: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get Variable Collections Tool
  server.tool(
    "get_variable_collections",
    "Get all variable collections from the Figma document. Collections organize variables and define modes (e.g., light/dark theme).",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_variable_collections", {});
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting variable collections: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get Bound Variables Tool
  server.tool(
    "get_bound_variables",
    "Get all variable bindings for a node. Shows which variables are bound to fills, strokes, and other properties.",
    {
      nodeId: z.string().describe("The ID of the node to inspect")
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("get_bound_variables", { nodeId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting bound variables: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Fill Variable Tool
  server.tool(
    "set_fill_variable",
    "Bind a color variable to a node's fill. Use this for theme-compatible colors instead of hardcoded RGB values.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      variableId: z.string().describe("The ID of the color variable to bind"),
      fillIndex: z.number().optional().describe("Index of the fill to modify (default: 0)")
    },
    async ({ nodeId, variableId, fillIndex }) => {
      try {
        const result = await sendCommandToFigma("set_fill_variable", {
          nodeId,
          variableId,
          fillIndex: fillIndex ?? 0
        });
        const typedResult = result as { name: string; variableName: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully bound variable "${typedResult.variableName}" to fill of node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting fill variable: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Stroke Variable Tool
  server.tool(
    "set_stroke_variable",
    "Bind a color variable to a node's stroke. Use this for theme-compatible border colors.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      variableId: z.string().describe("The ID of the color variable to bind"),
      strokeIndex: z.number().optional().describe("Index of the stroke to modify (default: 0)")
    },
    async ({ nodeId, variableId, strokeIndex }) => {
      try {
        const result = await sendCommandToFigma("set_stroke_variable", {
          nodeId,
          variableId,
          strokeIndex: strokeIndex ?? 0
        });
        const typedResult = result as { name: string; variableName: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully bound variable "${typedResult.variableName}" to stroke of node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting stroke variable: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Fill Style ID Tool
  server.tool(
    "set_fill_style_id",
    "Apply a fill style to a node in Figma. Use get_styles to find available fill style IDs.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      fillStyleId: z.string().describe("The ID of the fill style to apply")
    },
    async ({ nodeId, fillStyleId }) => {
      try {
        const result = await sendCommandToFigma("set_fill_style_id", {
          nodeId,
          fillStyleId
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully applied fill style to node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting fill style: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Stroke Style ID Tool
  server.tool(
    "set_stroke_style_id",
    "Apply a stroke style to a node in Figma. Use get_styles to find available stroke style IDs.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      strokeStyleId: z.string().describe("The ID of the stroke style to apply")
    },
    async ({ nodeId, strokeStyleId }) => {
      try {
        const result = await sendCommandToFigma("set_stroke_style_id", {
          nodeId,
          strokeStyleId
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully applied stroke style to node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting stroke style: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Set Text Style ID Tool
  server.tool(
    "set_text_style_id",
    "Apply a text style to a text node in Figma. Use get_styles to find available text style IDs.",
    {
      nodeId: z.string().describe("The ID of the text node to modify"),
      textStyleId: z.string().describe("The ID of the text style to apply")
    },
    async ({ nodeId, textStyleId }) => {
      try {
        const result = await sendCommandToFigma("set_text_style_id", {
          nodeId,
          textStyleId
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully applied text style to node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting text style: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Resolve Variable by Name Tool
  server.tool(
    "resolve_variable_by_name",
    "Find a variable ID by its name. Useful for binding variables when you know the semantic name (e.g., 'base-100', 'primary').",
    {
      name: z.string().describe("The name of the variable to find (e.g., 'base-100', 'primary', 'neutral')"),
      collectionName: z.string().optional().describe("Optional: Filter by collection name")
    },
    async ({ name, collectionName }) => {
      try {
        const result = await sendCommandToFigma("resolve_variable_by_name", {
          name,
          collectionName
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error resolving variable: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Clear Variable Binding Tool
  server.tool(
    "clear_variable_binding",
    "Remove a variable binding from a node property, reverting to the static value.",
    {
      nodeId: z.string().describe("The ID of the node to modify"),
      field: z.enum(["fills", "strokes", "width", "height", "opacity", "cornerRadius"]).describe("The field to clear the binding from")
    },
    async ({ nodeId, field }) => {
      try {
        const result = await sendCommandToFigma("clear_variable_binding", {
          nodeId,
          field
        });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Successfully cleared ${field} variable binding from node "${typedResult.name}"`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error clearing variable binding: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}