import { useMemo } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

type BreakpointName = "mobile" | "tablet" | "desktop" | "ultraWide";

export const useResponsive = () => {
  const theme = useTheme();

  const isTabletUp = useMediaQuery(theme.breakpoints.up("sm"));
  const isDesktopUp = useMediaQuery(theme.breakpoints.up("md"));
  const isUltraWide = useMediaQuery(theme.breakpoints.up("xl"));

  return useMemo(
    () => ({
      isMobile: !isTabletUp,
      isTablet: isTabletUp && !isDesktopUp,
      isDesktop: isDesktopUp && !isUltraWide,
      isUltraWide,
      isTabletUp,
      isDesktopUp,
      currentBreakpoint: (
        isUltraWide
          ? "ultraWide"
          : isDesktopUp
            ? "desktop"
            : isTabletUp
              ? "tablet"
              : "mobile"
      ) as BreakpointName,
    }),
    [isTabletUp, isDesktopUp, isUltraWide],
  );
};

