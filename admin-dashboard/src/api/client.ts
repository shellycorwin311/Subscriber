const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("staffToken");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error?.toString() || `Request failed (${res.status})`, res.status);
  }

  // Some endpoints (CSV export) don't return JSON.
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text() as unknown as T;
}

// --- Types ---

export interface Paper {
  id: string;
  name: string;
  slug: string;
}

export interface Subscription {
  id: string;
  paperId: string;
  paper: Paper;
  type: "PRINT" | "DIGITAL" | "PRINT_DIGITAL";
  tier: string;
  status: "PENDING" | "ACTIVE" | "PAUSED" | "LAPSED" | "CANCELED";
  startDate: string;
  renewalDate: string;
}

export interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  billingAddressLine1?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  deliveryAddressLine1?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryZip?: string | null;
  subscriptions: Subscription[];
}

export interface Payment {
  id: string;
  amountCents: number;
  status: "SUCCEEDED" | "FAILED" | "REFUNDED" | "PENDING";
  processedAt: string | null;
  createdAt: string;
}

export interface CirculationRow {
  paper: string;
  print: number;
  digital: number;
  printAndDigital: number;
  total: number;
}

export interface StaffAccount {
  id: string;
  email: string;
  role: "ADMIN" | "CUSTOMER_SERVICE" | "CIRCULATION";
  createdAt: string;
}

// --- Auth ---

export function login(email: string, password: string) {
  return request<{ token: string; staff: StaffAccount }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return request<StaffAccount>("/api/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function createStaffAccount(data: {
  email: string;
  password: string;
  role: StaffAccount["role"];
}) {
  return request<StaffAccount>("/api/auth/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Subscribers ---

export function searchSubscribers(query: string, page = 1) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return request<Subscriber[]>(`/api/subscribers?${params.toString()}`);
}

export function fetchSubscriber(id: string) {
  return request<Subscriber>(`/api/subscribers/${id}`);
}

export function updateSubscriber(id: string, data: Partial<Subscriber>) {
  return request<Subscriber>(`/api/subscribers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchPaymentHistory(subscriberId: string) {
  return request<Payment[]>(`/api/payments/subscriber/${subscriberId}`);
}

// --- Subscriptions ---

export function pauseSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/pause`, { method: "POST" });
}

export function resumeSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/resume`, { method: "POST" });
}

export function cancelSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/cancel`, { method: "POST" });
}

// --- Papers ---

export function fetchPapers() {
  return request<Paper[]>("/api/papers");
}

// --- Delivery routes ---

export function exportRouteCsv(paperId: string) {
  return request<string>(`/api/delivery-routes/${paperId}/export`);
}

// --- Reports ---

export function fetchCirculationReport() {
  return request<CirculationRow[]>("/api/reports/circulation");
}

export function fetchRevenueReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<{ totalRevenue: number; paymentCount: number }>(
    `/api/reports/revenue?${params.toString()}`
  );
}

export function fetchChurnReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<{ canceledCount: number }>(`/api/reports/churn?${params.toString()}`);
}

export { getToken };
