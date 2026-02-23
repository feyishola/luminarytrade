import React, { createContext, useContext, useState } from "react";
import { AppError } from "./types";

interface ErrorContextType {
  error: AppError | null;
  setError: (error: AppError | null) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<AppError | null>(null);

  return (
    <ErrorContext.Provider value={{ error, setError }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useGlobalError = () => {
  const context = useContext(ErrorContext);
  if (!context) throw new Error("useGlobalError must be used within ErrorProvider");
  return context;
};