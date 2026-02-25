import { createTheme } from "@mui/material/styles";

export const breakpointValues = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  ultraWide: 1536,
} as const;

export const spacing = {
  unit: 4,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typographyScale = {
  h1: "2.25rem",
  h2: "1.875rem",
  h3: "1.5rem",
  h4: "1.25rem",
  h5: "1.125rem",
  h6: "1rem",
  bodyLg: "1rem",
  body: "0.9375rem",
  bodySm: "0.875rem",
  caption: "0.75rem",
} as const;

export const colorPalette = {
  primary: "#2563eb",
  secondary: "#0ea5e9",
  success: "#16a34a",
  warning: "#f59e0b",
  error: "#dc2626",
  background: "#f8fafc",
  surface: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  border: "#e2e8f0",
} as const;

declare module "@mui/material/styles" {
  interface Theme {
    appDesign: {
      breakpoints: typeof breakpointValues;
      spacing: typeof spacing;
      typographyScale: typeof typographyScale;
      colorPalette: typeof colorPalette;
    };
  }
  interface ThemeOptions {
    appDesign?: Theme["appDesign"];
  }
}

export const appTheme = createTheme({
  spacing: spacing.unit,
  breakpoints: {
    values: {
      xs: breakpointValues.mobile,
      sm: breakpointValues.tablet,
      md: breakpointValues.desktop,
      lg: 1280,
      xl: breakpointValues.ultraWide,
    },
  },
  palette: {
    mode: "light",
    primary: { main: colorPalette.primary },
    secondary: { main: colorPalette.secondary },
    success: { main: colorPalette.success },
    warning: { main: colorPalette.warning },
    error: { main: colorPalette.error },
    background: {
      default: colorPalette.background,
      paper: colorPalette.surface,
    },
    text: {
      primary: colorPalette.textPrimary,
      secondary: colorPalette.textSecondary,
    },
    divider: colorPalette.border,
  },
  typography: {
    fontFamily: "'Inter', 'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    h1: { fontSize: typographyScale.h1, fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: typographyScale.h2, fontWeight: 700, lineHeight: 1.25 },
    h3: { fontSize: typographyScale.h3, fontWeight: 700, lineHeight: 1.3 },
    h4: { fontSize: typographyScale.h4, fontWeight: 600, lineHeight: 1.35 },
    h5: { fontSize: typographyScale.h5, fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: typographyScale.h6, fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: typographyScale.body, lineHeight: 1.6 },
    body2: { fontSize: typographyScale.bodySm, lineHeight: 1.6 },
    caption: { fontSize: typographyScale.caption, lineHeight: 1.5 },
  },
  shape: {
    borderRadius: 10,
  },
  appDesign: {
    breakpoints: breakpointValues,
    spacing,
    typographyScale,
    colorPalette,
  },
});

