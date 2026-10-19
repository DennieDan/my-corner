export type PublicCode = "BAD_REQUEST" | "METHOD_NOT_ALLOWED" | "UPSTREAM_UNAVAILABLE" | "AGENT_TIMEOUT" | "ANSWER_UNVERIFIED";

export class AgentError extends Error {
  constructor(
    public readonly code: PublicCode,
    public readonly status: number,
    public readonly retryable = false,
  ) {
    super(code);
  }
}

export function publicMessage(code: PublicCode): string {
  switch (code) {
    case "BAD_REQUEST": return "The chat request is invalid.";
    case "METHOD_NOT_ALLOWED": return "This method is not supported.";
    case "AGENT_TIMEOUT": return "Dennie took too long to respond. Please try again.";
    case "ANSWER_UNVERIFIED": return "Dennie could not verify this answer. Please try again.";
    default: return "Dennie is temporarily unavailable.";
  }
}

export function providerError(error: unknown): AgentError {
  if (error instanceof AgentError) return error;
  if (error instanceof Error && error.name === "AbortError") return new AgentError("AGENT_TIMEOUT", 504);
  return new AgentError("UPSTREAM_UNAVAILABLE", 503);
}

export async function retryTransient<T>(
  action: () => Promise<T>,
  signal: AbortSignal,
  sleep: (ms: number, signal: AbortSignal) => Promise<void> = delay,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    if (signal.aborted) throw signal.reason;
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof AgentError && error.retryable) || attempt >= 2) throw error;
      await sleep(100 * 2 ** attempt, signal);
    }
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function operationSignal(parent: AbortSignal, timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent.reason);
  if (parent.aborted) onAbort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new AgentError("AGENT_TIMEOUT", 504)), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => { clearTimeout(timer); parent.removeEventListener("abort", onAbort); },
  };
}
