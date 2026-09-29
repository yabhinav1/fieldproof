/**
 * Client for this app's own API. Every route answers `{ ok: true, data }` or
 * `{ ok: false, error, details? }`, where `error` is a message meant to be shown to the user.
 */

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** Resolves to `data`, or throws an ApiError carrying the server's own message. */
export async function apiFetch<T>(
    url: string,
    init?: RequestInit,
    fallbackMessage = "Request failed"
): Promise<T> {
    const response = await fetch(url, init);

    // A gateway timeout or crash page is HTML; its parse error must not become the message.
    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
        const message =
            typeof body?.error === "string" && body.error
                ? body.error
                : fallbackMessage;

        throw new ApiError(message, response.status, body?.details);
    }

    return body.data as T;
}

export function jsonRequest(
    method: "POST" | "PATCH" | "PUT",
    payload: unknown
): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
}

/** True for the rejection a fetch gives when its AbortController fired. */
export function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}
