class ErrorService {
  log(error: unknown) {
    console.error("Logged Error:", error);

    // Example: Send to monitoring service
    if (process.env.NODE_ENV === "production") {
      fetch("/api/log-error", {
        method: "POST",
        body: JSON.stringify({ error }),
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}

export const errorService = new ErrorService();