/**
 * CloudCanvas-TF Design Tokens and Constants
 * Centralized configuration for theming and layout
 */

// Canvas Node Dimensions
export const CANVAS_CONSTANTS = {
    NODE_WIDTH: 200,
    NODE_HEIGHT: 72,
    NODE_BORDER_RADIUS: 12,
    NODE_PADDING: 16,
    
    // Grid
    GRID_SIZE: 40,
    GRID_DOT_RADIUS: 1,
    
    // Default ViewBox
    DEFAULT_VIEWBOX: {
        x: 0,
        y: 0,
        w: 1600,
        h: 900,
    },
    
    // Zoom
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 4,
    ZOOM_STEP: 0.2,
    
    // Edge
    EDGE_STROKE_WIDTH: 2.5,
    EDGE_HIT_AREA_WIDTH: 20,
    
    // Connector
    CONNECTOR_BAR_WIDTH: 60,
    CONNECTOR_BAR_HEIGHT: 6,
} as const;

// Layout Spacing
export const LAYOUT_CONSTANTS = {
    // Palette
    PALETTE_NODE_SPACING_X: 240,
    PALETTE_NODE_SPACING_Y: 130,
    PALETTE_NODE_JITTER: 30,
    PALETTE_NODE_START_X: 200,
    PALETTE_NODE_START_Y: 100,
    PALETTE_COLUMNS: 3,
    
    // Panels
    TOP_BAR_HEIGHT: 52,
    LEFT_PANEL_WIDTH: 260,
    RIGHT_PANEL_WIDTH: 320,
    BOTTOM_PANEL_HEIGHT: 200,
} as const;

// Animation Durations (in ms)
export const ANIMATION_CONSTANTS = {
    TRANSITION_FAST: 150,
    TRANSITION_NORMAL: 200,
    TRANSITION_SLOW: 300,
    DEBOUNCE_VALIDATION: 300,
    DEBOUNCE_GENERATION: 500,
    AUTO_SAVE_DELAY: 30000,
} as const;

// History
export const HISTORY_CONSTANTS = {
    MAX_UNDO_STACK_SIZE: 50,
} as const;

// Validation
export const VALIDATION_CONSTANTS = {
    MIN_DISK_SIZE_GB: 10,
    MAX_DISK_SIZE_GB: 65536,
    ZONE_REGEX: /^[a-z]+-[a-z]+\d+-[a-z]$/,
    RESOURCE_NAME_REGEX: /^[a-zA-Z][a-zA-Z0-9-_]*$/,
} as const;

// Colors (CSS custom property names)
export const COLOR_TOKENS = {
    // Backgrounds
    BG_PRIMARY: '--bg-primary',
    BG_SECONDARY: '--bg-secondary',
    BG_ELEVATED: '--bg-elevated',
    BG_CANVAS: '--bg-canvas',
    BG_NODE: '--bg-node',
    BG_INPUT: '--bg-input',
    BG_HOVER: '--bg-hover',
    BG_TOPBAR: '--bg-topbar',
    
    // Text
    TEXT_PRIMARY: '--text-primary',
    TEXT_SECONDARY: '--text-secondary',
    TEXT_TERTIARY: '--text-tertiary',
    
    // Accents
    ACCENT_PRIMARY: '--accent-primary',
    ACCENT_PRIMARY_RGB: '--accent-primary-rgb',
    
    // Semantic
    COLOR_ERROR: '--color-error',
    COLOR_WARNING: '--color-warning',
    COLOR_SUCCESS: '--color-success',
    COLOR_INFO: '--color-info',
    
    // Border
    BORDER_COLOR: '--border-color',
} as const;

// Resource Categories Order
export const CATEGORY_ORDER = [
    'Network',
    'Compute',
    'Storage',
    'Kubernetes',
    'Database',
    'Serverless',
    'Security',
    'Messaging',
] as const;

// Export type for resource categories
export type ResourceCategoryType = typeof CATEGORY_ORDER[number];
