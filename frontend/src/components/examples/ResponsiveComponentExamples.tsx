import React from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useResponsive } from "../../hooks/useResponsive";
import { colorPalette, spacing, typographyScale } from "../../styles/theme";

const ResponsiveComponentExamples: React.FC = () => {
  const { currentBreakpoint, isMobile, isTablet, isDesktop, isUltraWide } = useResponsive();

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Responsive Design System Examples
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Active breakpoint: <strong>{currentBreakpoint}</strong>
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
        <Chip label={`mobile: ${isMobile}`} color={isMobile ? "primary" : "default"} />
        <Chip label={`tablet: ${isTablet}`} color={isTablet ? "primary" : "default"} />
        <Chip label={`desktop: ${isDesktop}`} color={isDesktop ? "primary" : "default"} />
        <Chip label={`ultraWide: ${isUltraWide}`} color={isUltraWide ? "primary" : "default"} />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {[
          { label: "Spacing Grid", value: `${spacing.unit}px base` },
          { label: "Typography", value: `h4 ${typographyScale.h4}` },
          { label: "Primary Color", value: colorPalette.primary },
          { label: "Surface Color", value: colorPalette.surface },
        ].map((item) => (
          <Paper key={item.label} variant="outlined" sx={{ p: spacing.md / spacing.unit }}>
            <Typography variant="subtitle2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {item.value}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default ResponsiveComponentExamples;

