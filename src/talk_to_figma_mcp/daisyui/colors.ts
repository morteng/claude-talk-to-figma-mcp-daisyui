/**
 * Color Palette and Token Mapping
 *
 * This module provides color matching between Figma colors and:
 * - DaisyUI semantic colors (primary, secondary, accent, etc.)
 * - Tailwind CSS color palette (slate-500, blue-600, etc.)
 * - Custom/brand colors
 *
 * Also provides utilities for spacing, typography, and other design tokens.
 */

// ============================================================
// DAISYUI SEMANTIC COLORS
// ============================================================

export interface DaisyUIColorInfo {
  name: string;
  var: string;
  category: 'brand' | 'base' | 'state' | 'content';
  description?: string;
}

export const DAISYUI_COLORS: Record<string, DaisyUIColorInfo> = {
  // Primary brand colors
  '#570df8': { name: 'primary', var: '--p', category: 'brand' },
  '#f000b8': { name: 'secondary', var: '--s', category: 'brand' },
  '#37cdbe': { name: 'accent', var: '--a', category: 'brand' },

  // Neutral colors
  '#3d4451': { name: 'neutral', var: '--n', category: 'base' },
  '#2a2e37': { name: 'neutral-focus', var: '--nf', category: 'base' },

  // Base colors
  '#ffffff': { name: 'base-100', var: '--b1', category: 'base' },
  '#f2f2f2': { name: 'base-200', var: '--b2', category: 'base' },
  '#e5e5e5': { name: 'base-300', var: '--b3', category: 'base' },
  '#1f2937': { name: 'base-content', var: '--bc', category: 'base' },

  // State colors
  '#36d399': { name: 'success', var: '--su', category: 'state' },
  '#3abff8': { name: 'info', var: '--in', category: 'state' },
  '#fbbd23': { name: 'warning', var: '--wa', category: 'state' },
  '#f87272': { name: 'error', var: '--er', category: 'state' },
};

// DaisyUI color name patterns for variable name matching
export const DAISYUI_NAME_PATTERNS: Array<{ pattern: RegExp; name: string; category: string }> = [
  // Brand colors
  { pattern: /\bprimary[-_]?content\b/i, name: 'primary-content', category: 'content' },
  { pattern: /\bsecondary[-_]?content\b/i, name: 'secondary-content', category: 'content' },
  { pattern: /\baccent[-_]?content\b/i, name: 'accent-content', category: 'content' },
  { pattern: /\bprimary\b/i, name: 'primary', category: 'brand' },
  { pattern: /\bsecondary\b/i, name: 'secondary', category: 'brand' },
  { pattern: /\baccent\b/i, name: 'accent', category: 'brand' },

  // Base colors
  { pattern: /\bneutral[-_]?content\b/i, name: 'neutral-content', category: 'content' },
  { pattern: /\bneutral\b/i, name: 'neutral', category: 'base' },
  { pattern: /\bbase[-_]?content\b/i, name: 'base-content', category: 'content' },
  { pattern: /\bbase[-_]?300\b/i, name: 'base-300', category: 'base' },
  { pattern: /\bbase[-_]?200\b/i, name: 'base-200', category: 'base' },
  { pattern: /\bbase[-_]?100\b/i, name: 'base-100', category: 'base' },

  // State colors
  { pattern: /\bsuccess[-_]?content\b/i, name: 'success-content', category: 'content' },
  { pattern: /\binfo[-_]?content\b/i, name: 'info-content', category: 'content' },
  { pattern: /\bwarning[-_]?content\b/i, name: 'warning-content', category: 'content' },
  { pattern: /\berror[-_]?content\b/i, name: 'error-content', category: 'content' },
  { pattern: /\bsuccess\b/i, name: 'success', category: 'state' },
  { pattern: /\binfo\b/i, name: 'info', category: 'state' },
  { pattern: /\bwarning\b/i, name: 'warning', category: 'state' },
  { pattern: /\berror\b/i, name: 'error', category: 'state' },
];

// ============================================================
// TAILWIND CSS COLOR PALETTE
// ============================================================

export interface TailwindColorInfo {
  name: string;
  shade: string;
  hex: string;
}

// Complete Tailwind CSS v3 color palette
export const TAILWIND_COLORS: Record<string, TailwindColorInfo> = {
  // Slate
  '#f8fafc': { name: 'slate', shade: '50', hex: '#f8fafc' },
  '#f1f5f9': { name: 'slate', shade: '100', hex: '#f1f5f9' },
  '#e2e8f0': { name: 'slate', shade: '200', hex: '#e2e8f0' },
  '#cbd5e1': { name: 'slate', shade: '300', hex: '#cbd5e1' },
  '#94a3b8': { name: 'slate', shade: '400', hex: '#94a3b8' },
  '#64748b': { name: 'slate', shade: '500', hex: '#64748b' },
  '#475569': { name: 'slate', shade: '600', hex: '#475569' },
  '#334155': { name: 'slate', shade: '700', hex: '#334155' },
  '#1e293b': { name: 'slate', shade: '800', hex: '#1e293b' },
  '#0f172a': { name: 'slate', shade: '900', hex: '#0f172a' },
  '#020617': { name: 'slate', shade: '950', hex: '#020617' },

  // Gray
  '#f9fafb': { name: 'gray', shade: '50', hex: '#f9fafb' },
  '#f3f4f6': { name: 'gray', shade: '100', hex: '#f3f4f6' },
  '#e5e7eb': { name: 'gray', shade: '200', hex: '#e5e7eb' },
  '#d1d5db': { name: 'gray', shade: '300', hex: '#d1d5db' },
  '#9ca3af': { name: 'gray', shade: '400', hex: '#9ca3af' },
  '#6b7280': { name: 'gray', shade: '500', hex: '#6b7280' },
  '#4b5563': { name: 'gray', shade: '600', hex: '#4b5563' },
  '#374151': { name: 'gray', shade: '700', hex: '#374151' },
  // '#1f2937' already used for base-content, add alternative key
  '#111827': { name: 'gray', shade: '900', hex: '#111827' },
  '#030712': { name: 'gray', shade: '950', hex: '#030712' },

  // Zinc
  '#fafafa': { name: 'zinc', shade: '50', hex: '#fafafa' },
  '#f4f4f5': { name: 'zinc', shade: '100', hex: '#f4f4f5' },
  '#e4e4e7': { name: 'zinc', shade: '200', hex: '#e4e4e7' },
  '#d4d4d8': { name: 'zinc', shade: '300', hex: '#d4d4d8' },
  '#a1a1aa': { name: 'zinc', shade: '400', hex: '#a1a1aa' },
  '#71717a': { name: 'zinc', shade: '500', hex: '#71717a' },
  '#52525b': { name: 'zinc', shade: '600', hex: '#52525b' },
  '#3f3f46': { name: 'zinc', shade: '700', hex: '#3f3f46' },
  '#27272a': { name: 'zinc', shade: '800', hex: '#27272a' },
  '#18181b': { name: 'zinc', shade: '900', hex: '#18181b' },
  '#09090b': { name: 'zinc', shade: '950', hex: '#09090b' },

  // Neutral (Tailwind)
  '#fafafa_neutral': { name: 'neutral', shade: '50', hex: '#fafafa' },
  '#f5f5f5': { name: 'neutral', shade: '100', hex: '#f5f5f5' },
  // '#e5e5e5' already used for base-300
  '#d4d4d4': { name: 'neutral', shade: '300', hex: '#d4d4d4' },
  '#a3a3a3': { name: 'neutral', shade: '400', hex: '#a3a3a3' },
  '#737373': { name: 'neutral', shade: '500', hex: '#737373' },
  '#525252': { name: 'neutral', shade: '600', hex: '#525252' },
  '#404040': { name: 'neutral', shade: '700', hex: '#404040' },
  '#262626': { name: 'neutral', shade: '800', hex: '#262626' },
  '#171717': { name: 'neutral', shade: '900', hex: '#171717' },
  '#0a0a0a': { name: 'neutral', shade: '950', hex: '#0a0a0a' },

  // Stone
  '#fafaf9': { name: 'stone', shade: '50', hex: '#fafaf9' },
  '#f5f5f4': { name: 'stone', shade: '100', hex: '#f5f5f4' },
  '#e7e5e4': { name: 'stone', shade: '200', hex: '#e7e5e4' },
  '#d6d3d1': { name: 'stone', shade: '300', hex: '#d6d3d1' },
  '#a8a29e': { name: 'stone', shade: '400', hex: '#a8a29e' },
  '#78716c': { name: 'stone', shade: '500', hex: '#78716c' },
  '#57534e': { name: 'stone', shade: '600', hex: '#57534e' },
  '#44403c': { name: 'stone', shade: '700', hex: '#44403c' },
  '#292524': { name: 'stone', shade: '800', hex: '#292524' },
  '#1c1917': { name: 'stone', shade: '900', hex: '#1c1917' },
  '#0c0a09': { name: 'stone', shade: '950', hex: '#0c0a09' },

  // Red
  '#fef2f2': { name: 'red', shade: '50', hex: '#fef2f2' },
  '#fee2e2': { name: 'red', shade: '100', hex: '#fee2e2' },
  '#fecaca': { name: 'red', shade: '200', hex: '#fecaca' },
  '#fca5a5': { name: 'red', shade: '300', hex: '#fca5a5' },
  '#f87171': { name: 'red', shade: '400', hex: '#f87171' },
  '#ef4444': { name: 'red', shade: '500', hex: '#ef4444' },
  '#dc2626': { name: 'red', shade: '600', hex: '#dc2626' },
  '#b91c1c': { name: 'red', shade: '700', hex: '#b91c1c' },
  '#991b1b': { name: 'red', shade: '800', hex: '#991b1b' },
  '#7f1d1d': { name: 'red', shade: '900', hex: '#7f1d1d' },
  '#450a0a': { name: 'red', shade: '950', hex: '#450a0a' },

  // Orange
  '#fff7ed': { name: 'orange', shade: '50', hex: '#fff7ed' },
  '#ffedd5': { name: 'orange', shade: '100', hex: '#ffedd5' },
  '#fed7aa': { name: 'orange', shade: '200', hex: '#fed7aa' },
  '#fdba74': { name: 'orange', shade: '300', hex: '#fdba74' },
  '#fb923c': { name: 'orange', shade: '400', hex: '#fb923c' },
  '#f97316': { name: 'orange', shade: '500', hex: '#f97316' },
  '#ea580c': { name: 'orange', shade: '600', hex: '#ea580c' },
  '#c2410c': { name: 'orange', shade: '700', hex: '#c2410c' },
  '#9a3412': { name: 'orange', shade: '800', hex: '#9a3412' },
  '#7c2d12': { name: 'orange', shade: '900', hex: '#7c2d12' },
  '#431407': { name: 'orange', shade: '950', hex: '#431407' },

  // Amber
  '#fffbeb': { name: 'amber', shade: '50', hex: '#fffbeb' },
  '#fef3c7': { name: 'amber', shade: '100', hex: '#fef3c7' },
  '#fde68a': { name: 'amber', shade: '200', hex: '#fde68a' },
  '#fcd34d': { name: 'amber', shade: '300', hex: '#fcd34d' },
  '#fbbf24': { name: 'amber', shade: '400', hex: '#fbbf24' },
  '#f59e0b': { name: 'amber', shade: '500', hex: '#f59e0b' },
  '#d97706': { name: 'amber', shade: '600', hex: '#d97706' },
  '#b45309': { name: 'amber', shade: '700', hex: '#b45309' },
  '#92400e': { name: 'amber', shade: '800', hex: '#92400e' },
  '#78350f': { name: 'amber', shade: '900', hex: '#78350f' },
  '#451a03': { name: 'amber', shade: '950', hex: '#451a03' },

  // Yellow
  '#fefce8': { name: 'yellow', shade: '50', hex: '#fefce8' },
  '#fef9c3': { name: 'yellow', shade: '100', hex: '#fef9c3' },
  '#fef08a': { name: 'yellow', shade: '200', hex: '#fef08a' },
  '#fde047': { name: 'yellow', shade: '300', hex: '#fde047' },
  '#facc15': { name: 'yellow', shade: '400', hex: '#facc15' },
  '#eab308': { name: 'yellow', shade: '500', hex: '#eab308' },
  '#ca8a04': { name: 'yellow', shade: '600', hex: '#ca8a04' },
  '#a16207': { name: 'yellow', shade: '700', hex: '#a16207' },
  '#854d0e': { name: 'yellow', shade: '800', hex: '#854d0e' },
  '#713f12': { name: 'yellow', shade: '900', hex: '#713f12' },
  '#422006': { name: 'yellow', shade: '950', hex: '#422006' },

  // Lime
  '#f7fee7': { name: 'lime', shade: '50', hex: '#f7fee7' },
  '#ecfccb': { name: 'lime', shade: '100', hex: '#ecfccb' },
  '#d9f99d': { name: 'lime', shade: '200', hex: '#d9f99d' },
  '#bef264': { name: 'lime', shade: '300', hex: '#bef264' },
  '#a3e635': { name: 'lime', shade: '400', hex: '#a3e635' },
  '#84cc16': { name: 'lime', shade: '500', hex: '#84cc16' },
  '#65a30d': { name: 'lime', shade: '600', hex: '#65a30d' },
  '#4d7c0f': { name: 'lime', shade: '700', hex: '#4d7c0f' },
  '#3f6212': { name: 'lime', shade: '800', hex: '#3f6212' },
  '#365314': { name: 'lime', shade: '900', hex: '#365314' },
  '#1a2e05': { name: 'lime', shade: '950', hex: '#1a2e05' },

  // Green
  '#f0fdf4': { name: 'green', shade: '50', hex: '#f0fdf4' },
  '#dcfce7': { name: 'green', shade: '100', hex: '#dcfce7' },
  '#bbf7d0': { name: 'green', shade: '200', hex: '#bbf7d0' },
  '#86efac': { name: 'green', shade: '300', hex: '#86efac' },
  '#4ade80': { name: 'green', shade: '400', hex: '#4ade80' },
  '#22c55e': { name: 'green', shade: '500', hex: '#22c55e' },
  '#16a34a': { name: 'green', shade: '600', hex: '#16a34a' },
  '#15803d': { name: 'green', shade: '700', hex: '#15803d' },
  '#166534': { name: 'green', shade: '800', hex: '#166534' },
  '#14532d': { name: 'green', shade: '900', hex: '#14532d' },
  '#052e16': { name: 'green', shade: '950', hex: '#052e16' },

  // Emerald
  '#ecfdf5': { name: 'emerald', shade: '50', hex: '#ecfdf5' },
  '#d1fae5': { name: 'emerald', shade: '100', hex: '#d1fae5' },
  '#a7f3d0': { name: 'emerald', shade: '200', hex: '#a7f3d0' },
  '#6ee7b7': { name: 'emerald', shade: '300', hex: '#6ee7b7' },
  '#34d399': { name: 'emerald', shade: '400', hex: '#34d399' },
  '#10b981': { name: 'emerald', shade: '500', hex: '#10b981' },
  '#059669': { name: 'emerald', shade: '600', hex: '#059669' },
  '#047857': { name: 'emerald', shade: '700', hex: '#047857' },
  '#065f46': { name: 'emerald', shade: '800', hex: '#065f46' },
  '#064e3b': { name: 'emerald', shade: '900', hex: '#064e3b' },
  '#022c22': { name: 'emerald', shade: '950', hex: '#022c22' },

  // Teal
  '#f0fdfa': { name: 'teal', shade: '50', hex: '#f0fdfa' },
  '#ccfbf1': { name: 'teal', shade: '100', hex: '#ccfbf1' },
  '#99f6e4': { name: 'teal', shade: '200', hex: '#99f6e4' },
  '#5eead4': { name: 'teal', shade: '300', hex: '#5eead4' },
  '#2dd4bf': { name: 'teal', shade: '400', hex: '#2dd4bf' },
  '#14b8a6': { name: 'teal', shade: '500', hex: '#14b8a6' },
  '#0d9488': { name: 'teal', shade: '600', hex: '#0d9488' },
  '#0f766e': { name: 'teal', shade: '700', hex: '#0f766e' },
  '#115e59': { name: 'teal', shade: '800', hex: '#115e59' },
  '#134e4a': { name: 'teal', shade: '900', hex: '#134e4a' },
  '#042f2e': { name: 'teal', shade: '950', hex: '#042f2e' },

  // Cyan
  '#ecfeff': { name: 'cyan', shade: '50', hex: '#ecfeff' },
  '#cffafe': { name: 'cyan', shade: '100', hex: '#cffafe' },
  '#a5f3fc': { name: 'cyan', shade: '200', hex: '#a5f3fc' },
  '#67e8f9': { name: 'cyan', shade: '300', hex: '#67e8f9' },
  '#22d3ee': { name: 'cyan', shade: '400', hex: '#22d3ee' },
  '#06b6d4': { name: 'cyan', shade: '500', hex: '#06b6d4' },
  '#0891b2': { name: 'cyan', shade: '600', hex: '#0891b2' },
  '#0e7490': { name: 'cyan', shade: '700', hex: '#0e7490' },
  '#155e75': { name: 'cyan', shade: '800', hex: '#155e75' },
  '#164e63': { name: 'cyan', shade: '900', hex: '#164e63' },
  '#083344': { name: 'cyan', shade: '950', hex: '#083344' },

  // Sky
  '#f0f9ff': { name: 'sky', shade: '50', hex: '#f0f9ff' },
  '#e0f2fe': { name: 'sky', shade: '100', hex: '#e0f2fe' },
  '#bae6fd': { name: 'sky', shade: '200', hex: '#bae6fd' },
  '#7dd3fc': { name: 'sky', shade: '300', hex: '#7dd3fc' },
  '#38bdf8': { name: 'sky', shade: '400', hex: '#38bdf8' },
  '#0ea5e9': { name: 'sky', shade: '500', hex: '#0ea5e9' },
  '#0284c7': { name: 'sky', shade: '600', hex: '#0284c7' },
  '#0369a1': { name: 'sky', shade: '700', hex: '#0369a1' },
  '#075985': { name: 'sky', shade: '800', hex: '#075985' },
  '#0c4a6e': { name: 'sky', shade: '900', hex: '#0c4a6e' },
  '#082f49': { name: 'sky', shade: '950', hex: '#082f49' },

  // Blue
  '#eff6ff': { name: 'blue', shade: '50', hex: '#eff6ff' },
  '#dbeafe': { name: 'blue', shade: '100', hex: '#dbeafe' },
  '#bfdbfe': { name: 'blue', shade: '200', hex: '#bfdbfe' },
  '#93c5fd': { name: 'blue', shade: '300', hex: '#93c5fd' },
  '#60a5fa': { name: 'blue', shade: '400', hex: '#60a5fa' },
  '#3b82f6': { name: 'blue', shade: '500', hex: '#3b82f6' },
  '#2563eb': { name: 'blue', shade: '600', hex: '#2563eb' },
  '#1d4ed8': { name: 'blue', shade: '700', hex: '#1d4ed8' },
  '#1e40af': { name: 'blue', shade: '800', hex: '#1e40af' },
  '#1e3a8a': { name: 'blue', shade: '900', hex: '#1e3a8a' },
  '#172554': { name: 'blue', shade: '950', hex: '#172554' },

  // Indigo
  '#eef2ff': { name: 'indigo', shade: '50', hex: '#eef2ff' },
  '#e0e7ff': { name: 'indigo', shade: '100', hex: '#e0e7ff' },
  '#c7d2fe': { name: 'indigo', shade: '200', hex: '#c7d2fe' },
  '#a5b4fc': { name: 'indigo', shade: '300', hex: '#a5b4fc' },
  '#818cf8': { name: 'indigo', shade: '400', hex: '#818cf8' },
  '#6366f1': { name: 'indigo', shade: '500', hex: '#6366f1' },
  '#4f46e5': { name: 'indigo', shade: '600', hex: '#4f46e5' },
  '#4338ca': { name: 'indigo', shade: '700', hex: '#4338ca' },
  '#3730a3': { name: 'indigo', shade: '800', hex: '#3730a3' },
  '#312e81': { name: 'indigo', shade: '900', hex: '#312e81' },
  '#1e1b4b': { name: 'indigo', shade: '950', hex: '#1e1b4b' },

  // Violet
  '#f5f3ff': { name: 'violet', shade: '50', hex: '#f5f3ff' },
  '#ede9fe': { name: 'violet', shade: '100', hex: '#ede9fe' },
  '#ddd6fe': { name: 'violet', shade: '200', hex: '#ddd6fe' },
  '#c4b5fd': { name: 'violet', shade: '300', hex: '#c4b5fd' },
  '#a78bfa': { name: 'violet', shade: '400', hex: '#a78bfa' },
  '#8b5cf6': { name: 'violet', shade: '500', hex: '#8b5cf6' },
  '#7c3aed': { name: 'violet', shade: '600', hex: '#7c3aed' },
  '#6d28d9': { name: 'violet', shade: '700', hex: '#6d28d9' },
  '#5b21b6': { name: 'violet', shade: '800', hex: '#5b21b6' },
  '#4c1d95': { name: 'violet', shade: '900', hex: '#4c1d95' },
  '#2e1065': { name: 'violet', shade: '950', hex: '#2e1065' },

  // Purple
  '#faf5ff': { name: 'purple', shade: '50', hex: '#faf5ff' },
  '#f3e8ff': { name: 'purple', shade: '100', hex: '#f3e8ff' },
  '#e9d5ff': { name: 'purple', shade: '200', hex: '#e9d5ff' },
  '#d8b4fe': { name: 'purple', shade: '300', hex: '#d8b4fe' },
  '#c084fc': { name: 'purple', shade: '400', hex: '#c084fc' },
  '#a855f7': { name: 'purple', shade: '500', hex: '#a855f7' },
  '#9333ea': { name: 'purple', shade: '600', hex: '#9333ea' },
  '#7e22ce': { name: 'purple', shade: '700', hex: '#7e22ce' },
  '#6b21a8': { name: 'purple', shade: '800', hex: '#6b21a8' },
  '#581c87': { name: 'purple', shade: '900', hex: '#581c87' },
  '#3b0764': { name: 'purple', shade: '950', hex: '#3b0764' },

  // Fuchsia
  '#fdf4ff': { name: 'fuchsia', shade: '50', hex: '#fdf4ff' },
  '#fae8ff': { name: 'fuchsia', shade: '100', hex: '#fae8ff' },
  '#f5d0fe': { name: 'fuchsia', shade: '200', hex: '#f5d0fe' },
  '#f0abfc': { name: 'fuchsia', shade: '300', hex: '#f0abfc' },
  '#e879f9': { name: 'fuchsia', shade: '400', hex: '#e879f9' },
  '#d946ef': { name: 'fuchsia', shade: '500', hex: '#d946ef' },
  '#c026d3': { name: 'fuchsia', shade: '600', hex: '#c026d3' },
  '#a21caf': { name: 'fuchsia', shade: '700', hex: '#a21caf' },
  '#86198f': { name: 'fuchsia', shade: '800', hex: '#86198f' },
  '#701a75': { name: 'fuchsia', shade: '900', hex: '#701a75' },
  '#4a044e': { name: 'fuchsia', shade: '950', hex: '#4a044e' },

  // Pink
  '#fdf2f8': { name: 'pink', shade: '50', hex: '#fdf2f8' },
  '#fce7f3': { name: 'pink', shade: '100', hex: '#fce7f3' },
  '#fbcfe8': { name: 'pink', shade: '200', hex: '#fbcfe8' },
  '#f9a8d4': { name: 'pink', shade: '300', hex: '#f9a8d4' },
  '#f472b6': { name: 'pink', shade: '400', hex: '#f472b6' },
  '#ec4899': { name: 'pink', shade: '500', hex: '#ec4899' },
  '#db2777': { name: 'pink', shade: '600', hex: '#db2777' },
  '#be185d': { name: 'pink', shade: '700', hex: '#be185d' },
  '#9d174d': { name: 'pink', shade: '800', hex: '#9d174d' },
  '#831843': { name: 'pink', shade: '900', hex: '#831843' },
  '#500724': { name: 'pink', shade: '950', hex: '#500724' },

  // Rose
  '#fff1f2': { name: 'rose', shade: '50', hex: '#fff1f2' },
  '#ffe4e6': { name: 'rose', shade: '100', hex: '#ffe4e6' },
  '#fecdd3': { name: 'rose', shade: '200', hex: '#fecdd3' },
  '#fda4af': { name: 'rose', shade: '300', hex: '#fda4af' },
  '#fb7185': { name: 'rose', shade: '400', hex: '#fb7185' },
  '#f43f5e': { name: 'rose', shade: '500', hex: '#f43f5e' },
  '#e11d48': { name: 'rose', shade: '600', hex: '#e11d48' },
  '#be123c': { name: 'rose', shade: '700', hex: '#be123c' },
  '#9f1239': { name: 'rose', shade: '800', hex: '#9f1239' },
  '#881337': { name: 'rose', shade: '900', hex: '#881337' },
  '#4c0519': { name: 'rose', shade: '950', hex: '#4c0519' },
};

// Tailwind color name patterns for variable name matching
export const TAILWIND_COLOR_NAMES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose'
];

export const TAILWIND_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// ============================================================
// TAILWIND SPACING SCALE
// ============================================================

// Tailwind spacing scale (Figma px → Tailwind class)
export const TAILWIND_SPACING: Record<number, string> = {
  0: '0',
  1: 'px',
  2: '0.5',
  4: '1',
  6: '1.5',
  8: '2',
  10: '2.5',
  12: '3',
  14: '3.5',
  16: '4',
  20: '5',
  24: '6',
  28: '7',
  32: '8',
  36: '9',
  40: '10',
  44: '11',
  48: '12',
  56: '14',
  64: '16',
  80: '20',
  96: '24',
  112: '28',
  128: '32',
  144: '36',
  160: '40',
  176: '44',
  192: '48',
  208: '52',
  224: '56',
  240: '60',
  256: '64',
  288: '72',
  320: '80',
  384: '96',
};

// Spacing token patterns for variable name detection
export const SPACING_PATTERNS: Array<{ pattern: RegExp; multiplier: number }> = [
  { pattern: /spacing[-_]?(\d+)/i, multiplier: 4 },  // spacing-4 = 16px
  { pattern: /space[-_]?(\d+)/i, multiplier: 4 },
  { pattern: /gap[-_]?(\d+)/i, multiplier: 4 },
  { pattern: /padding[-_]?(\d+)/i, multiplier: 4 },
  { pattern: /margin[-_]?(\d+)/i, multiplier: 4 },
  { pattern: /(\d+)[-_]?px/i, multiplier: 1 },  // Direct px values
];

// ============================================================
// TAILWIND TYPOGRAPHY SCALE
// ============================================================

// Tailwind font size scale
export const TAILWIND_FONT_SIZES: Record<number, string> = {
  12: 'text-xs',
  14: 'text-sm',
  16: 'text-base',
  18: 'text-lg',
  20: 'text-xl',
  24: 'text-2xl',
  30: 'text-3xl',
  36: 'text-4xl',
  48: 'text-5xl',
  60: 'text-6xl',
  72: 'text-7xl',
  96: 'text-8xl',
  128: 'text-9xl',
};

// Tailwind font weight scale
export const TAILWIND_FONT_WEIGHTS: Record<number, string> = {
  100: 'font-thin',
  200: 'font-extralight',
  300: 'font-light',
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
  800: 'font-extrabold',
  900: 'font-black',
};

// Line height scale
export const TAILWIND_LINE_HEIGHTS: Record<number, string> = {
  1: 'leading-none',
  1.25: 'leading-tight',
  1.375: 'leading-snug',
  1.5: 'leading-normal',
  1.625: 'leading-relaxed',
  2: 'leading-loose',
};

// Letter spacing scale
export const TAILWIND_LETTER_SPACING: Record<number, string> = {
  '-0.05': 'tracking-tighter',
  '-0.025': 'tracking-tight',
  '0': 'tracking-normal',
  '0.025': 'tracking-wide',
  '0.05': 'tracking-wider',
  '0.1': 'tracking-widest',
};

// ============================================================
// TAILWIND BORDER RADIUS SCALE
// ============================================================

export const TAILWIND_RADIUS: Record<number, string> = {
  0: 'rounded-none',
  2: 'rounded-sm',
  4: 'rounded',
  6: 'rounded-md',
  8: 'rounded-lg',
  12: 'rounded-xl',
  16: 'rounded-2xl',
  24: 'rounded-3xl',
  9999: 'rounded-full',
};

// ============================================================
// TAILWIND SHADOW SCALE
// ============================================================

export const TAILWIND_SHADOWS: Record<number, string> = {
  0: 'shadow-none',
  2: 'shadow-sm',
  4: 'shadow',
  6: 'shadow-md',
  10: 'shadow-lg',
  15: 'shadow-xl',
  25: 'shadow-2xl',
};

// ============================================================
// TAILWIND OPACITY SCALE
// ============================================================

export const TAILWIND_OPACITY: Record<number, string> = {
  0: 'opacity-0',
  5: 'opacity-5',
  10: 'opacity-10',
  20: 'opacity-20',
  25: 'opacity-25',
  30: 'opacity-30',
  40: 'opacity-40',
  50: 'opacity-50',
  60: 'opacity-60',
  70: 'opacity-70',
  75: 'opacity-75',
  80: 'opacity-80',
  90: 'opacity-90',
  95: 'opacity-95',
  100: 'opacity-100',
};

// ============================================================
// COLOR CONVERSION UTILITIES
// ============================================================

/**
 * Convert RGB (0-1 range from Figma) to hex
 */
export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex to RGB (0-255 range)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
    case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
    case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Format HSL as CSS string
 */
export function hslToString(hsl: { h: number; s: number; l: number }): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Calculate color distance (Euclidean in RGB space)
 */
export function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Calculate WCAG contrast ratio between two colors
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string): number => {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// COLOR MATCHING FUNCTIONS
// ============================================================

/**
 * Match a hex color to the closest DaisyUI color
 * Returns null if no close match found (threshold: 50)
 */
export function matchDaisyUIColor(hex: string): string | null {
  const hexLower = hex.toLowerCase();

  // Exact match first
  if (DAISYUI_COLORS[hexLower]) {
    return DAISYUI_COLORS[hexLower].name;
  }

  // Fuzzy match
  let closest: string | null = null;
  let minDist = 50; // Threshold for "close enough"

  for (const [colorHex, info] of Object.entries(DAISYUI_COLORS)) {
    const dist = colorDistance(hexLower, colorHex);
    if (dist < minDist) {
      minDist = dist;
      closest = info.name;
    }
  }

  return closest;
}

/**
 * Match a hex color to the closest Tailwind color
 * Returns null if no close match found (threshold: 30)
 */
export function matchTailwindColor(hex: string): TailwindColorInfo | null {
  const hexLower = hex.toLowerCase();

  // Exact match first
  if (TAILWIND_COLORS[hexLower]) {
    return TAILWIND_COLORS[hexLower];
  }

  // Fuzzy match
  let closest: TailwindColorInfo | null = null;
  let minDist = 30; // Threshold for "close enough"

  for (const [colorHex, info] of Object.entries(TAILWIND_COLORS)) {
    const dist = colorDistance(hexLower, colorHex);
    if (dist < minDist) {
      minDist = dist;
      closest = info;
    }
  }

  return closest;
}

/**
 * Detect DaisyUI color name from variable name
 */
export function detectDaisyUINameFromVariable(variableName: string): { name: string; category: string } | null {
  for (const { pattern, name, category } of DAISYUI_NAME_PATTERNS) {
    if (pattern.test(variableName)) {
      return { name, category };
    }
  }
  return null;
}

/**
 * Detect Tailwind color from variable name
 * Matches patterns like: "blue-500", "slate_600", "emerald 400"
 */
export function detectTailwindFromVariable(variableName: string): { name: string; shade: string } | null {
  const nameLower = variableName.toLowerCase();

  for (const colorName of TAILWIND_COLOR_NAMES) {
    // Match patterns: blue-500, blue_500, blue 500, blue500
    const pattern = new RegExp(`\\b${colorName}[-_\\s]?(\\d{2,3})\\b`, 'i');
    const match = nameLower.match(pattern);

    if (match && TAILWIND_SHADES.includes(match[1])) {
      return { name: colorName, shade: match[1] };
    }

    // Also match just the color name without shade (assume 500)
    if (nameLower.includes(colorName) && !nameLower.match(/\d{2,3}/)) {
      // Check if it's really the color name, not part of another word
      const wordPattern = new RegExp(`\\b${colorName}\\b`, 'i');
      if (wordPattern.test(nameLower)) {
        return { name: colorName, shade: '500' };
      }
    }
  }

  return null;
}

// ============================================================
// VALUE SCALE MATCHING
// ============================================================

/**
 * Find closest value in a scale
 */
export function findClosest(value: number, options: number[]): number {
  return options.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/**
 * Map Figma spacing to Tailwind class
 */
export function spacingToTailwind(px: number): string | null {
  const spacings = Object.keys(TAILWIND_SPACING).map(Number);
  const closest = findClosest(px, spacings);
  return TAILWIND_SPACING[closest] || null;
}

/**
 * Map Figma font size to Tailwind class
 */
export function fontSizeToTailwind(px: number): string {
  const sizes = Object.keys(TAILWIND_FONT_SIZES).map(Number);
  const closest = findClosest(px, sizes);
  return TAILWIND_FONT_SIZES[closest];
}

/**
 * Map Figma font weight to Tailwind class
 */
export function fontWeightToTailwind(weight: number): string {
  const weights = Object.keys(TAILWIND_FONT_WEIGHTS).map(Number);
  const closest = findClosest(weight, weights);
  return TAILWIND_FONT_WEIGHTS[closest];
}

/**
 * Map Figma corner radius to Tailwind class
 */
export function radiusToTailwind(px: number): string {
  const radii = Object.keys(TAILWIND_RADIUS).map(Number);
  const closest = findClosest(px, radii);
  return TAILWIND_RADIUS[closest];
}

/**
 * Map Figma shadow blur to Tailwind class
 */
export function shadowToTailwind(blur: number): string {
  const blurs = Object.keys(TAILWIND_SHADOWS).map(Number);
  const closest = findClosest(blur, blurs);
  return TAILWIND_SHADOWS[closest];
}

/**
 * Map opacity percentage to Tailwind class
 */
export function opacityToTailwind(opacity: number): string {
  // Convert from 0-1 to 0-100 if needed
  const percent = opacity <= 1 ? Math.round(opacity * 100) : Math.round(opacity);
  const opacities = Object.keys(TAILWIND_OPACITY).map(Number);
  const closest = findClosest(percent, opacities);
  return TAILWIND_OPACITY[closest];
}

// ============================================================
// VARIABLE CLASSIFICATION
// ============================================================

export type TokenType = 'color' | 'spacing' | 'typography' | 'radius' | 'shadow' | 'opacity' | 'sizing' | 'boolean' | 'string' | 'unknown';
export type ColorSystem = 'daisyui' | 'tailwind' | 'custom' | 'brand';
export type SemanticRole = 'background' | 'foreground' | 'border' | 'accent' | 'interactive' | 'state' | 'content' | 'unknown';

export interface VariableClassification {
  tokenType: TokenType;
  colorSystem?: ColorSystem;
  daisyuiName?: string;
  daisyuiCategory?: string;
  tailwindName?: string;
  tailwindShade?: string;
  semanticRole?: SemanticRole;
  tailwindClass?: string;
  cssVariable?: string;
}

/**
 * Classify a variable based on its name and type
 */
export function classifyVariable(
  name: string,
  resolvedType: string,
  hex?: string
): VariableClassification {
  const nameLower = name.toLowerCase();
  const result: VariableClassification = { tokenType: 'unknown' };

  // Determine token type from Figma's resolved type
  switch (resolvedType) {
    case 'COLOR':
      result.tokenType = 'color';
      break;
    case 'FLOAT':
      // Could be spacing, radius, opacity, etc. - need to infer from name
      if (nameLower.match(/opacity|alpha|transparent/i)) {
        result.tokenType = 'opacity';
      } else if (nameLower.match(/radius|corner|round/i)) {
        result.tokenType = 'radius';
      } else if (nameLower.match(/shadow|blur|spread|elevation/i)) {
        result.tokenType = 'shadow';
      } else if (nameLower.match(/spacing|gap|padding|margin|space/i)) {
        result.tokenType = 'spacing';
      } else if (nameLower.match(/size|width|height|min|max/i)) {
        result.tokenType = 'sizing';
      } else if (nameLower.match(/font|text|line|letter|tracking/i)) {
        result.tokenType = 'typography';
      } else {
        result.tokenType = 'spacing'; // Default for FLOAT
      }
      break;
    case 'STRING':
      result.tokenType = 'string';
      break;
    case 'BOOLEAN':
      result.tokenType = 'boolean';
      break;
  }

  // For colors, try to determine the color system
  if (result.tokenType === 'color') {
    // Check DaisyUI first (semantic names take priority)
    const daisyui = detectDaisyUINameFromVariable(name);
    if (daisyui) {
      result.colorSystem = 'daisyui';
      result.daisyuiName = daisyui.name;
      result.daisyuiCategory = daisyui.category;
      result.cssVariable = `--${daisyui.name.replace(/-/g, '')}`;

      // Determine semantic role
      if (daisyui.category === 'content') {
        result.semanticRole = 'content';
      } else if (daisyui.category === 'state') {
        result.semanticRole = 'state';
      } else if (daisyui.category === 'base') {
        result.semanticRole = daisyui.name.includes('content') ? 'foreground' : 'background';
      } else {
        result.semanticRole = 'accent';
      }
    } else {
      // Check Tailwind colors
      const tailwind = detectTailwindFromVariable(name);
      if (tailwind) {
        result.colorSystem = 'tailwind';
        result.tailwindName = tailwind.name;
        result.tailwindShade = tailwind.shade;
        result.tailwindClass = `${tailwind.name}-${tailwind.shade}`;
        result.cssVariable = `--color-${tailwind.name}-${tailwind.shade}`;

        // Infer semantic role from shade
        const shade = parseInt(tailwind.shade);
        if (shade <= 200) {
          result.semanticRole = 'background';
        } else if (shade >= 800) {
          result.semanticRole = 'foreground';
        } else {
          result.semanticRole = 'accent';
        }
      } else if (hex) {
        // Try to match by color value
        const daisyuiMatch = matchDaisyUIColor(hex);
        if (daisyuiMatch) {
          result.colorSystem = 'daisyui';
          result.daisyuiName = daisyuiMatch;
        } else {
          const tailwindMatch = matchTailwindColor(hex);
          if (tailwindMatch) {
            result.colorSystem = 'tailwind';
            result.tailwindName = tailwindMatch.name;
            result.tailwindShade = tailwindMatch.shade;
            result.tailwindClass = `${tailwindMatch.name}-${tailwindMatch.shade}`;
          } else {
            // Check if it looks like a brand color
            if (nameLower.match(/brand|logo|corporate|company/i)) {
              result.colorSystem = 'brand';
            } else {
              result.colorSystem = 'custom';
            }
          }
        }
      }
    }

    // Additional semantic role detection from name
    if (!result.semanticRole) {
      if (nameLower.match(/background|bg[-_]|surface/i)) {
        result.semanticRole = 'background';
      } else if (nameLower.match(/foreground|fg[-_]|text[-_]color/i)) {
        result.semanticRole = 'foreground';
      } else if (nameLower.match(/border|stroke|outline/i)) {
        result.semanticRole = 'border';
      } else if (nameLower.match(/hover|active|pressed|focus|disabled/i)) {
        result.semanticRole = 'interactive';
      } else {
        result.semanticRole = 'unknown';
      }
    }
  }

  return result;
}
