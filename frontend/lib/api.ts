import type { AuthSession } from "@/types/api";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthSession | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function refreshSession(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.status === 401) {
        setAccessToken(null);
        return null;
      }

      const session = await readResponse<AuthSession>(response);
      setAccessToken(session.accessToken);
      return session;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const firstResponse = await fetchWithAccessToken(path, init);
  if (
    firstResponse.status !== 401 ||
    !accessToken ||
    ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"].includes(
      path,
    )
  ) {
    return readResponse<T>(firstResponse);
  }

  const session = await refreshSession();
  if (!session) {
    return readResponse<T>(firstResponse);
  }

  const retryResponse = await fetchWithAccessToken(path, init);
  return readResponse<T>(retryResponse);
}

async function fetchWithAccessToken(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const bodyText = await response.text();
  let body: unknown;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      if (response.ok) {
        throw new Error("The API returned an invalid response.");
      }
      throw new ApiError(`Request failed with status ${response.status}.`, response.status);
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? body.message
        : undefined;
    throw new ApiError(
      Array.isArray(message)
        ? message.map(String).join(", ")
        : typeof message === "string"
          ? message
          : `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  return body as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
