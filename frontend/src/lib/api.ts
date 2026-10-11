const configuredApiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim();
export const API_BASE = configuredApiUrl.replace(/\/$/, "");
export type Role = "admin" | "manager" | "user";
export type User = { id: string; _id?: string; name: string; email: string; role: Role; createdAt?: string };
export type Transaction = { _id: string; title: string; description?: string; amount: number; status: "pending" | "approved" | "rejected"; createdAt: string; createdBy?: { name: string; email: string } };
export type Summary = { totalTransactions: number; pending: number; approved: number; rejected: number; totalAmount: number; approvedAmount: number; usersCount: number | null };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new Error("Cannot reach SecureOps API. Check that the backend is running."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || `Request failed (${response.status}).`, response.status);
  return data as T;
}
