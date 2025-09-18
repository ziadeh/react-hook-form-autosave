export class AutosaveError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = "AutosaveError";
  }

  static fromUnknown(error: unknown, code = "UNKNOWN_ERROR"): AutosaveError {
    if (error instanceof AutosaveError) return error;

    const originalError =
      error instanceof Error ? error : new Error(String(error));
    return new AutosaveError(
      `Autosave failed: ${originalError.message}`,
      code,
      originalError
    );
  }
}

export class TransportError extends AutosaveError {
  constructor(message: string, originalError?: Error) {
    super(message, "TRANSPORT_ERROR", originalError);
  }
}

export class ValidationError extends AutosaveError {
  constructor(message: string, public failedFields?: string[]) {
    super(message, "VALIDATION_ERROR", undefined, { failedFields });
  }
}

export class DiffError extends AutosaveError {
  constructor(message: string, public field?: string, originalError?: Error) {
    super(message, "DIFF_ERROR", originalError, { field });
  }
}
