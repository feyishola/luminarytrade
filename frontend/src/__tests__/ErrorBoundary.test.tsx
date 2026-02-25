import { render } from "@testing-library/react";
import { ErrorBoundary } from "../errors/ErrorBoundary";

const Broken = () => {
  throw new Error("Crash");
};

test("renders fallback UI on error", () => {
  const { getByText } = render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>
  );

  expect(getByText("Something went wrong.")).toBeInTheDocument();
});