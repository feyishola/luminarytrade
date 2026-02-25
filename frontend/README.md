# ChenAIKit Frontend

Frontend applications and UI components for ChenAIKit.

## Features

- React-based web applications
- Material-UI components
- Responsive design
- Real-time data updates
- Interactive dashboards
- Mobile-friendly interface

## Applications

- **Credit Scoring Dashboard** - Visualize credit scores and risk factors
- **Wallet Interface** - Manage blockchain accounts and transactions
- **Fraud Detection Alerts** - Monitor and respond to fraud alerts
- **Analytics Dashboard** - View comprehensive analytics and reports

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Build for production
pnpm build

# Run tests
pnpm test
```

## Development

The frontend uses:
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Material-UI** - Professional UI components
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls

## Responsive Design System

Design-system source files:
- `src/styles/theme.ts` - centralized theme, breakpoints, spacing, typography, and colors
- `src/styles/responsive.ts` - reusable media-query and responsive value utilities
- `src/hooks/useResponsive.ts` - `useMediaQuery` wrappers for runtime breakpoint detection

Defined breakpoints:
- `mobile`: `0px`
- `tablet`: `640px`
- `desktop`: `1024px`
- `ultraWide`: `1536px`

Spacing system:
- 4px base grid (`theme.spacing(1) === 4px`)
- Token scale (`xxs` to `xxl`) exported from `src/styles/theme.ts`

Usage example:

```tsx
import { useResponsive } from "../hooks/useResponsive";
import { spacing } from "../styles/theme";

const Example = () => {
  const { isMobile } = useResponsive();
  return (
    <div
      style={{
        display: "grid",
        gap: spacing.md,
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      }}
    />
  );
};
```

Reference implementation:
- `src/components/CreditScoring.tsx`
- `src/components/examples/ResponsiveComponentExamples.tsx`
- `src/components/Dashboard.tsx`

## Environment Variables

```env
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_STELLAR_NETWORK=testnet
REACT_APP_AI_SERVICE_URL=https://api.chenaikit.com
```
