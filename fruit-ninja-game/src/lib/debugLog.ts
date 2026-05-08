export function debugLog(payload: unknown) {
  // Fire-and-forget to same-origin API to avoid CORS issues in browser.
  fetch("/api/__debug", {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  }).catch(() => {});
}

