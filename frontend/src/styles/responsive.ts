import { breakpointValues } from "./theme";

export type ResponsiveBreakpoint = keyof typeof breakpointValues;

export const media = {
  up: (breakpoint: ResponsiveBreakpoint) =>
    `@media (min-width: ${breakpointValues[breakpoint]}px)`,
  down: (breakpoint: ResponsiveBreakpoint) =>
    `@media (max-width: ${breakpointValues[breakpoint] - 0.02}px)`,
  between: (min: ResponsiveBreakpoint, max: ResponsiveBreakpoint) =>
    `@media (min-width: ${breakpointValues[min]}px) and (max-width: ${
      breakpointValues[max] - 0.02
    }px)`,
};

export const responsiveValue = <T,>(
  viewportWidth: number,
  values: Partial<Record<ResponsiveBreakpoint, T>>,
  fallback: T,
): T => {
  if (viewportWidth >= breakpointValues.ultraWide && values.ultraWide !== undefined) {
    return values.ultraWide;
  }
  if (viewportWidth >= breakpointValues.desktop && values.desktop !== undefined) {
    return values.desktop;
  }
  if (viewportWidth >= breakpointValues.tablet && values.tablet !== undefined) {
    return values.tablet;
  }
  if (values.mobile !== undefined) {
    return values.mobile;
  }
  return fallback;
};

