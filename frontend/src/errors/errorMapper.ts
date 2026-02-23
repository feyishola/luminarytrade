import { AppError } from "./types";

export function mapToUserMessage(error: AppError): string {
  switch (error.type) {
    case "NETWORK":
      return "Connection issue. Please check your internet.";
    case "AUTH":
      return "Session expired. Please login again.";
    case "VALIDATION":
      return "Invalid input. Please review your entries.";
    case "NOT_FOUND":
      return "Requested resource not found.";
    case "SERVER":
      return "Server error. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}