type ErrorLike = {
  message?: string;
  stack?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type RejectionEventLike = {
  reason?: unknown;
  preventDefault?: () => void;
};

type GlobalWithRuntimeHandlers = typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler?: (
      handler: (error: Error, isFatal?: boolean) => void,
    ) => void;
  };
  addEventListener?: (
    type: string,
    listener: (event: RejectionEventLike) => void,
  ) => void;
  removeEventListener?: (
    type: string,
    listener: (event: RejectionEventLike) => void,
  ) => void;
};

let activeAction = "unscoped";
let handlersInstalled = false;
let originalConsoleError: typeof console.error | null = null;

function normalizeError(value: unknown): ErrorLike {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  if (value && typeof value === "object") {
    return value as ErrorLike;
  }
  return { message: String(value) };
}

function diagnosticPayload(error: unknown, action = activeAction) {
  const normalized = normalizeError(error);
  return {
    action,
    message: normalized.message ?? "Unknown runtime error",
    code: normalized.code,
    details: normalized.details,
    hint: normalized.hint,
    status: normalized.status,
    stack: normalized.stack ?? new Error().stack,
  };
}

export function reportRuntimeError(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const logger = originalConsoleError ?? console.error;
  const payload = {
    ...diagnosticPayload(error, action),
    ...context,
  };
  logger("[Homie runtime error]", JSON.stringify(payload, null, 2));
}

export function reportSupabaseError(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  reportRuntimeError(`Supabase: ${action}`, error, context);
}

export async function withRuntimeAction<T>(
  action: string,
  work: () => Promise<T>,
): Promise<T> {
  const previousAction = activeAction;
  activeAction = action;
  try {
    return await work();
  } catch (error) {
    reportRuntimeError(action, error);
    throw error;
  } finally {
    activeAction = previousAction;
  }
}

export function installGlobalRuntimeDiagnostics() {
  if (handlersInstalled) return () => {};
  handlersInstalled = true;
  originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    const firstError = args.find(
      (value) =>
        value instanceof Error ||
        (value && typeof value === "object" && "message" in value),
    );
    originalConsoleError?.("[Homie console.error]", JSON.stringify({
      ...diagnosticPayload(firstError ?? args.map(String).join(" ")),
      arguments: args.map((value) =>
        value instanceof Error
          ? { message: value.message, stack: value.stack }
          : String(value),
      ),
    }, null, 2));
  };

  const runtimeGlobal = globalThis as GlobalWithRuntimeHandlers;
  const rejectionHandler = (event: RejectionEventLike) => {
    reportRuntimeError("Unhandled promise rejection", event.reason);
  };
  runtimeGlobal.addEventListener?.("unhandledrejection", rejectionHandler);

  const previousGlobalHandler =
    runtimeGlobal.ErrorUtils?.getGlobalHandler?.();
  runtimeGlobal.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    reportRuntimeError(
      isFatal ? "Unhandled fatal error" : "Unhandled global error",
      error,
    );
    previousGlobalHandler?.(error, isFatal);
  });

  return () => {
    console.error = originalConsoleError ?? console.error;
    runtimeGlobal.removeEventListener?.(
      "unhandledrejection",
      rejectionHandler,
    );
    if (previousGlobalHandler) {
      runtimeGlobal.ErrorUtils?.setGlobalHandler?.(previousGlobalHandler);
    }
    handlersInstalled = false;
  };
}
