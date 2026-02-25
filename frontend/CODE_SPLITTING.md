# Code Splitting and Performance Optimization Strategy

This document outlines the performance optimization techniques implemented in the LuminaryTrade frontend.

## 1. Route-Based Code Splitting
We use `React.lazy()` and `Suspense` to split the application into multiple chunks based on routes. This reduces the initial bundle size and speeds up the first paint.

**Implementation:**
- Main routes (`Dashboard`, `CreditScoring`, `FraudDetection`, `WalletInterface`) are lazily loaded in `App.tsx`.
- A global `Suspense` boundary handles the loading state.

## 2. Prefetching Strategy
To ensure a smooth user experience, we implement prefetching for frequently used routes. When a user hovers over a navigation link, the corresponding chunk is fetched in the background.

**Implementation:**
- `onMouseEnter` trigger on `Link` components in `App.tsx` calls a manual import to trigger browser prefetching.

## 3. Dynamic Imports for Heavy Components
Large components that are not immediately needed (e.g., charts, complex editors) are dynamically imported inside their parent components.

**Implementation:**
- `HeavyChart.tsx` is lazily loaded within `Dashboard.tsx`.

## 4. Image Optimization
- **Lazy Loading:** All images use the native `loading="lazy"` attribute.
- **Progressive Loading:** A `LazyImage` component is used to show a blurred placeholder while the full image loads.
- **Formats:** Use modern formats like WebP where possible.

## 5. Performance Monitoring
- **Bundle Analysis:** Run `npm run analyze` to visualize chunk sizes using `source-map-explorer`.
- **Performance Budget:** Refer to `performance-budget.json` for target metrics.

## 6. Build Optimization
The build process is configured to:
- Minify CSS and JS.
- Extract CSS into separate files.
- Generate source maps for debugging (analyzed during build).
