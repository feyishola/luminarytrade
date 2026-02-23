import { useGlobalError } from "./ErrorContext";
import { errorService } from "./errorService";
import { AppError } from "./types";

export const useErrorHandler = () => {
  const { setError } = useGlobalError();

  const handleError = (error: unknown, type: AppError["type"] = "UNKNOWN") => {
    const appError: AppError = {
      message: (error as Error)?.message || "Unknown error",
      type,
      originalError: error,
      retryable: type === "NETWORK",
    };

    errorService.log(appError);
    setError(appError);
  };

  return { handleError };
};