/**
 * DaisyUI Component Detection and Mapping
 *
 * This module provides intelligent detection of DaisyUI components from Figma node names
 * and properties. Used for automatic class assignment and code generation.
 */

export interface DaisyUIMapping {
  component: string;      // Component type: button, card, input, etc.
  class: string;          // Full DaisyUI class: "btn btn-primary"
  variant?: string;       // Variant: primary, secondary, etc.
  size?: string;          // Size: xs, sm, md, lg
  state?: string;         // State: active, disabled, etc.
}

export interface ComponentPattern {
  match: RegExp;
  component: string;
  category: string;
  getMapping: (name: string, parent: string) => DaisyUIMapping;
}

/**
 * Component detection patterns
 * Order matters - more specific patterns should come first
 */
export const COMPONENT_PATTERNS: ComponentPattern[] = [
  // ============================================================
  // BUTTONS
  // ============================================================
  {
    match: /btn|button/i,
    component: 'button',
    category: 'buttons',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';
      let size = 'md';

      // Detect variant
      if (combined.includes('primary')) variant = 'btn-primary';
      else if (combined.includes('secondary')) variant = 'btn-secondary';
      else if (combined.includes('accent')) variant = 'btn-accent';
      else if (combined.includes('neutral')) variant = 'btn-neutral';
      else if (combined.includes('ghost')) variant = 'btn-ghost';
      else if (combined.includes('link')) variant = 'btn-link';
      else if (combined.includes('info')) variant = 'btn-info';
      else if (combined.includes('success')) variant = 'btn-success';
      else if (combined.includes('warning')) variant = 'btn-warning';
      else if (combined.includes('error')) variant = 'btn-error';

      // Detect size
      if (combined.includes('xs') || combined.includes('extra-small')) size = 'xs';
      else if (combined.includes('sm') || combined.includes('small')) size = 'sm';
      else if (combined.includes('lg') || combined.includes('large')) size = 'lg';

      const classes = ['btn', variant, `btn-${size}`].filter(Boolean);

      return {
        component: 'button',
        class: classes.join(' '),
        variant: variant.replace('btn-', '') || undefined,
        size
      };
    }
  },

  // ============================================================
  // FORM INPUTS
  // ============================================================
  {
    match: /text.?input|input.?field|textfield/i,
    component: 'input',
    category: 'forms',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = 'input-bordered';
      let size = 'md';

      if (combined.includes('ghost')) variant = 'input-ghost';
      if (combined.includes('primary')) variant = 'input-primary';
      if (combined.includes('secondary')) variant = 'input-secondary';
      if (combined.includes('accent')) variant = 'input-accent';
      if (combined.includes('error')) variant = 'input-error';

      if (combined.includes('xs')) size = 'xs';
      else if (combined.includes('sm')) size = 'sm';
      else if (combined.includes('lg')) size = 'lg';

      return {
        component: 'input',
        class: `input ${variant} input-${size}`,
        variant: variant.replace('input-', ''),
        size
      };
    }
  },

  {
    match: /textarea/i,
    component: 'textarea',
    category: 'forms',
    getMapping: () => ({
      component: 'textarea',
      class: 'textarea textarea-bordered'
    })
  },

  {
    match: /select|dropdown/i,
    component: 'select',
    category: 'forms',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let size = 'md';

      if (combined.includes('xs')) size = 'xs';
      else if (combined.includes('sm')) size = 'sm';
      else if (combined.includes('lg')) size = 'lg';

      return {
        component: 'select',
        class: `select select-bordered select-${size}`,
        size
      };
    }
  },

  {
    match: /checkbox|check.?box/i,
    component: 'checkbox',
    category: 'forms',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'checkbox-primary';
      else if (combined.includes('secondary')) variant = 'checkbox-secondary';
      else if (combined.includes('accent')) variant = 'checkbox-accent';

      return {
        component: 'checkbox',
        class: `checkbox ${variant}`.trim(),
        variant: variant.replace('checkbox-', '') || undefined
      };
    }
  },

  {
    match: /radio/i,
    component: 'radio',
    category: 'forms',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'radio-primary';
      else if (combined.includes('secondary')) variant = 'radio-secondary';
      else if (combined.includes('accent')) variant = 'radio-accent';

      return {
        component: 'radio',
        class: `radio ${variant}`.trim(),
        variant: variant.replace('radio-', '') || undefined
      };
    }
  },

  {
    match: /toggle|switch/i,
    component: 'toggle',
    category: 'forms',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'toggle-primary';
      else if (combined.includes('secondary')) variant = 'toggle-secondary';
      else if (combined.includes('accent')) variant = 'toggle-accent';

      return {
        component: 'toggle',
        class: `toggle ${variant}`.trim(),
        variant: variant.replace('toggle-', '') || undefined
      };
    }
  },

  // ============================================================
  // CARDS
  // ============================================================
  {
    match: /card/i,
    component: 'card',
    category: 'cards',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('compact')) variant = 'card-compact';
      if (combined.includes('bordered')) variant = 'card-bordered';
      if (combined.includes('image-full')) variant = 'image-full';

      return {
        component: 'card',
        class: `card bg-base-100 shadow-xl ${variant}`.trim(),
        variant: variant || undefined
      };
    }
  },

  // ============================================================
  // NAVIGATION
  // ============================================================
  {
    match: /navbar/i,
    component: 'navbar',
    category: 'navigation',
    getMapping: () => ({
      component: 'navbar',
      class: 'navbar bg-base-100'
    })
  },

  {
    match: /breadcrumb/i,
    component: 'breadcrumbs',
    category: 'navigation',
    getMapping: () => ({
      component: 'breadcrumbs',
      class: 'breadcrumbs text-sm'
    })
  },

  {
    match: /tab/i,
    component: 'tabs',
    category: 'navigation',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('boxed')) variant = 'tabs-boxed';
      if (combined.includes('bordered')) variant = 'tabs-bordered';
      if (combined.includes('lifted')) variant = 'tabs-lifted';

      return {
        component: 'tabs',
        class: `tabs ${variant}`.trim(),
        variant: variant.replace('tabs-', '') || undefined
      };
    }
  },

  {
    match: /menu/i,
    component: 'menu',
    category: 'navigation',
    getMapping: () => ({
      component: 'menu',
      class: 'menu bg-base-200 rounded-box'
    })
  },

  // ============================================================
  // FEEDBACK
  // ============================================================
  {
    match: /alert/i,
    component: 'alert',
    category: 'feedback',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('info')) variant = 'alert-info';
      else if (combined.includes('success')) variant = 'alert-success';
      else if (combined.includes('warning')) variant = 'alert-warning';
      else if (combined.includes('error')) variant = 'alert-error';

      return {
        component: 'alert',
        class: `alert ${variant}`.trim(),
        variant: variant.replace('alert-', '') || undefined
      };
    }
  },

  {
    match: /toast/i,
    component: 'toast',
    category: 'feedback',
    getMapping: () => ({
      component: 'toast',
      class: 'toast'
    })
  },

  {
    match: /modal|dialog/i,
    component: 'modal',
    category: 'feedback',
    getMapping: () => ({
      component: 'modal',
      class: 'modal'
    })
  },

  {
    match: /tooltip/i,
    component: 'tooltip',
    category: 'feedback',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'tooltip-primary';
      else if (combined.includes('secondary')) variant = 'tooltip-secondary';
      else if (combined.includes('accent')) variant = 'tooltip-accent';
      else if (combined.includes('info')) variant = 'tooltip-info';
      else if (combined.includes('success')) variant = 'tooltip-success';
      else if (combined.includes('warning')) variant = 'tooltip-warning';
      else if (combined.includes('error')) variant = 'tooltip-error';

      return {
        component: 'tooltip',
        class: `tooltip ${variant}`.trim(),
        variant: variant.replace('tooltip-', '') || undefined
      };
    }
  },

  {
    match: /progress/i,
    component: 'progress',
    category: 'feedback',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'progress-primary';
      else if (combined.includes('secondary')) variant = 'progress-secondary';
      else if (combined.includes('accent')) variant = 'progress-accent';
      else if (combined.includes('info')) variant = 'progress-info';
      else if (combined.includes('success')) variant = 'progress-success';
      else if (combined.includes('warning')) variant = 'progress-warning';
      else if (combined.includes('error')) variant = 'progress-error';

      return {
        component: 'progress',
        class: `progress ${variant}`.trim(),
        variant: variant.replace('progress-', '') || undefined
      };
    }
  },

  {
    match: /loading|spinner/i,
    component: 'loading',
    category: 'feedback',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = 'loading-spinner';

      if (combined.includes('dots')) variant = 'loading-dots';
      if (combined.includes('ring')) variant = 'loading-ring';
      if (combined.includes('ball')) variant = 'loading-ball';
      if (combined.includes('bars')) variant = 'loading-bars';
      if (combined.includes('infinity')) variant = 'loading-infinity';

      return {
        component: 'loading',
        class: `loading ${variant}`,
        variant: variant.replace('loading-', '')
      };
    }
  },

  // ============================================================
  // DATA DISPLAY
  // ============================================================
  {
    match: /stat/i,
    component: 'stats',
    category: 'data-display',
    getMapping: () => ({
      component: 'stats',
      class: 'stats shadow'
    })
  },

  {
    match: /avatar/i,
    component: 'avatar',
    category: 'data-display',
    getMapping: () => ({
      component: 'avatar',
      class: 'avatar'
    })
  },

  {
    match: /badge/i,
    component: 'badge',
    category: 'data-display',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'badge-primary';
      else if (combined.includes('secondary')) variant = 'badge-secondary';
      else if (combined.includes('accent')) variant = 'badge-accent';
      else if (combined.includes('ghost')) variant = 'badge-ghost';
      else if (combined.includes('info')) variant = 'badge-info';
      else if (combined.includes('success')) variant = 'badge-success';
      else if (combined.includes('warning')) variant = 'badge-warning';
      else if (combined.includes('error')) variant = 'badge-error';
      else if (combined.includes('outline')) variant = 'badge-outline';

      return {
        component: 'badge',
        class: `badge ${variant}`.trim(),
        variant: variant.replace('badge-', '') || undefined
      };
    }
  },

  {
    match: /table/i,
    component: 'table',
    category: 'data-display',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('zebra')) variant = 'table-zebra';
      if (combined.includes('compact')) variant += ' table-compact';

      return {
        component: 'table',
        class: `table ${variant}`.trim(),
        variant: variant.trim() || undefined
      };
    }
  },

  // ============================================================
  // LAYOUT
  // ============================================================
  {
    match: /hero/i,
    component: 'hero',
    category: 'layout',
    getMapping: () => ({
      component: 'hero',
      class: 'hero min-h-screen bg-base-200'
    })
  },

  {
    match: /footer/i,
    component: 'footer',
    category: 'layout',
    getMapping: () => ({
      component: 'footer',
      class: 'footer p-10 bg-neutral text-neutral-content'
    })
  },

  {
    match: /divider/i,
    component: 'divider',
    category: 'layout',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('horizontal')) variant = 'divider-horizontal';
      if (combined.includes('vertical')) variant = 'divider-vertical';

      return {
        component: 'divider',
        class: `divider ${variant}`.trim(),
        variant: variant.replace('divider-', '') || undefined
      };
    }
  },

  {
    match: /drawer/i,
    component: 'drawer',
    category: 'layout',
    getMapping: () => ({
      component: 'drawer',
      class: 'drawer'
    })
  },

  // ============================================================
  // MISC
  // ============================================================
  {
    match: /collapse|accordion/i,
    component: 'collapse',
    category: 'misc',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('arrow')) variant = 'collapse-arrow';
      if (combined.includes('plus')) variant = 'collapse-plus';

      return {
        component: 'collapse',
        class: `collapse ${variant}`.trim(),
        variant: variant.replace('collapse-', '') || undefined
      };
    }
  },

  {
    match: /rating|star/i,
    component: 'rating',
    category: 'misc',
    getMapping: () => ({
      component: 'rating',
      class: 'rating'
    })
  },

  {
    match: /link/i,
    component: 'link',
    category: 'misc',
    getMapping: (name, parent) => {
      const combined = `${name} ${parent}`.toLowerCase();
      let variant = '';

      if (combined.includes('primary')) variant = 'link-primary';
      else if (combined.includes('secondary')) variant = 'link-secondary';
      else if (combined.includes('accent')) variant = 'link-accent';
      else if (combined.includes('neutral')) variant = 'link-neutral';
      else if (combined.includes('hover')) variant = 'link-hover';

      return {
        component: 'link',
        class: `link ${variant}`.trim(),
        variant: variant.replace('link-', '') || undefined
      };
    }
  },
];

/**
 * Detect DaisyUI component from Figma node name
 */
export function detectDaisyUIComponent(name: string, parentName: string = ''): DaisyUIMapping | null {
  const nameLower = name.toLowerCase();
  const parentLower = parentName.toLowerCase();

  for (const pattern of COMPONENT_PATTERNS) {
    if (pattern.match.test(nameLower) || pattern.match.test(parentLower)) {
      return pattern.getMapping(name, parentName);
    }
  }

  return null;
}

/**
 * Get component category from name
 */
export function getComponentCategory(name: string, parentName: string = ''): string {
  const nameLower = name.toLowerCase();
  const parentLower = parentName.toLowerCase();

  for (const pattern of COMPONENT_PATTERNS) {
    if (pattern.match.test(nameLower) || pattern.match.test(parentLower)) {
      return pattern.category;
    }
  }

  return 'other';
}

/**
 * Component usage hints for agent assistance
 */
export const COMPONENT_USAGE_HINTS: Record<string, { hint: string; contexts: string[] }> = {
  button: {
    hint: 'Use for clickable actions. Primary for main CTAs, secondary for alternative actions.',
    contexts: ['Submit forms', 'Navigate', 'Trigger actions', 'Confirm dialogs']
  },
  input: {
    hint: 'Text input for user data. Use with labels and validation messages.',
    contexts: ['Forms', 'Search', 'Filters', 'User data entry']
  },
  card: {
    hint: 'Container for related content. Use for dashboard widgets, list items, feature showcases.',
    contexts: ['Dashboard widgets', 'Product cards', 'User profiles', 'Feature highlights']
  },
  alert: {
    hint: 'Feedback messages. Use info for neutral, success for completion, warning for caution, error for problems.',
    contexts: ['Form validation', 'Status updates', 'Notifications', 'System messages']
  },
  modal: {
    hint: 'Overlay dialogs for focused tasks. Use sparingly, prefer inline interactions.',
    contexts: ['Confirmations', 'Forms', 'Details view', 'Media preview']
  },
  stats: {
    hint: 'Display key metrics and numbers prominently. Good for dashboards.',
    contexts: ['KPIs', 'Analytics', 'Summaries', 'Quick stats']
  },
  toast: {
    hint: 'Temporary notifications. Auto-dismiss for success, persist for errors.',
    contexts: ['Action feedback', 'Background process completion', 'Errors']
  },
  navbar: {
    hint: 'Top navigation bar. Keep it simple with logo, main nav, and user actions.',
    contexts: ['Site header', 'App bar', 'Navigation']
  },
  tabs: {
    hint: 'Switch between related views without page reload. Use for related content.',
    contexts: ['Settings sections', 'Content categories', 'View modes']
  },
  table: {
    hint: 'Display tabular data. Use zebra for readability, sorting for large datasets.',
    contexts: ['Data lists', 'Reports', 'Admin panels', 'Comparisons']
  }
};
