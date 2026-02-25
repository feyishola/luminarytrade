import { appTheme, breakpointValues, colorPalette, spacing } from "../styles/theme";
import { media, responsiveValue } from "../styles/responsive";

describe("responsive theme system", () => {
  test("defines required breakpoint keys", () => {
    expect(breakpointValues.mobile).toBe(0);
    expect(breakpointValues.tablet).toBeGreaterThan(breakpointValues.mobile);
    expect(breakpointValues.desktop).toBeGreaterThan(breakpointValues.tablet);
    expect(breakpointValues.ultraWide).toBeGreaterThan(breakpointValues.desktop);
  });

  test("uses 4px spacing grid", () => {
    expect(spacing.unit).toBe(4);
    expect(appTheme.spacing(1)).toBe("4px");
  });

  test("exposes consistent color palette through MUI theme", () => {
    expect(appTheme.palette.primary.main).toBe(colorPalette.primary);
    expect(appTheme.palette.background.default).toBe(colorPalette.background);
  });

  test("builds reusable media query helpers", () => {
    expect(media.up("tablet")).toContain("min-width");
    expect(media.between("tablet", "desktop")).toContain("max-width");
  });

  test("resolves responsive values by viewport width", () => {
    const values = { mobile: 1, tablet: 2, desktop: 3, ultraWide: 4 };
    expect(responsiveValue(320, values, 0)).toBe(1);
    expect(responsiveValue(700, values, 0)).toBe(2);
    expect(responsiveValue(1200, values, 0)).toBe(3);
    expect(responsiveValue(1800, values, 0)).toBe(4);
  });
});

