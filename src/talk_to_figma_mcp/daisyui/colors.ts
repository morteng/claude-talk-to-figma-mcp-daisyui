/**
 * DaisyUI Color Palette and Mapping
 *
 * This module provides color matching between Figma colors and DaisyUI semantic colors.
 * Used for automatic component detection and Tailwind class generation.
 */

// DaisyUI semantic colors with their default hex values
export const DAISYUI_COLORS: Record<string, { name: string; var: string; category: string }> = {
  // Primary colors
  '#570df8': { name: 'primary', var: '--p', category: 'primary' },
  '#f000b8': { name: 'secondary', var: '--s', category: 'secondary' },
  '#37cdbe': { name: 'accent', var: '--a', category: 'accent' },

  // Neutral colors
  '#3d4451': { name: 'neutral', var: '--n', category: 'neutral' },
  '#2a2e37': { name: 'neutral-focus', var: '--nf', category: 'neutral' },

  // Base colors (note: base-100 is typically white but uses different var)
  '#ffffff': { name: 'base-100', var: '--b1', category: 'base' },  // Also used as neutral-content
  '#f2f2f2': { name: 'base-200', var: '--b2', category: 'base' },
  '#e5e5e5': { name: 'base-300', var: '--b3', category: 'base' },
  '#1f2937': { name: 'base-content', var: '--bc', category: 'base' },

  // State colors
  '#36d399': { name: 'success', var: '--su', category: 'state' },
  '#3abff8': { name: 'info', var: '--in', category: 'state' },
  '#fbbd23': { name: 'warning', var: '--wa', category: 'state' },
  '#f87272': { name: 'error', var: '--er', category: 'state' },
};

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
};

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

// Tailwind border radius scale
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

// Tailwind shadow scale
export const TAILWIND_SHADOWS: Record<number, string> = {
  0: 'shadow-none',
  2: 'shadow-sm',
  4: 'shadow',
  6: 'shadow-md',
  10: 'shadow-lg',
  15: 'shadow-xl',
  25: 'shadow-2xl',
};

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
 * Convert hex to RGB
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
