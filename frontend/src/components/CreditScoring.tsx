import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import ResponsiveComponentExamples from "./examples/ResponsiveComponentExamples";
import { useResponsive } from "../hooks/useResponsive";
import { spacing } from "../styles/theme";

const CreditScoring: React.FC = () => {
  const { isMobile } = useResponsive();

  const cards = [
    { title: "Credit Utilization", value: "34%", status: "Good" },
    { title: "Payment History", value: "98%", status: "Excellent" },
    { title: "Account Age", value: "4.8y", status: "Healthy" },
    { title: "Risk Score", value: "672", status: "Moderate" },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Credit Scoring
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Responsive layout powered by the shared design system breakpoints and spacing scale.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: isMobile
            ? "1fr"
            : "repeat(auto-fit, minmax(220px, 1fr))",
          mb: 4,
        }}
      >
        {cards.map((card) => (
          <Paper
            key={card.title}
            variant="outlined"
            sx={{ p: spacing.md / spacing.unit, borderRadius: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {card.title}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1 }}>
              {card.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {card.status}
            </Typography>
          </Paper>
        ))}
      </Box>

      <ResponsiveComponentExamples />
    </Box>
  );
};

export default CreditScoring;

