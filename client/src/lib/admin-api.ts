import { getAdminAccessToken } from "./admin-auth";

const BASE = "/api";

async function adminFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as any).error ?? "Request failed"), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

export const adminApi = {
  login: (username: string, password: string) =>
    adminFetch<any>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getBuyOrders: () => adminFetch<{ orders: BuyOrder[] }>("/admin/buy-orders"),
  createBuyOrder: (data: {
    title?: string;
    amount?: number;
    paymentMethod?: string;
    upiId?: string;
    name?: string;
    accountNumber?: string;
    ifscCode?: string;
    description?: string;
    isActive?: boolean;
    quantity?: number;
  }) =>
    adminFetch<{ success: boolean; orders: BuyOrder[]; count: number }>("/admin/buy-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBuyOrder: (id: string, data: {
    title?: string;
    amount?: number;
    paymentMethod?: string;
    upiId?: string | null;
    name?: string;
    accountNumber?: string | null;
    ifscCode?: string | null;
    description?: string;
    isActive?: boolean;
    maxClaims?: number;
  }) =>
    adminFetch<{ success: boolean; order: BuyOrder }>(`/admin/buy-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteBuyOrder: (id: string) =>
    adminFetch<{ success: boolean }>(`/admin/buy-orders/${id}`, { method: "DELETE" }),

  adjustWallet: (userId: string, data: { type: "credit" | "debit"; amount: number; reason: string }) =>
    adminFetch<{ success: boolean; message: string }>(`/admin/users/${userId}/wallet-adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDeposits: (params?: Record<string, string>) =>
    adminFetch<any>(`/admin/deposits${params ? "?" + new URLSearchParams(params) : ""}`),

  getUsers: (params?: Record<string, string>) =>
    adminFetch<any>(`/admin/users${params ? "?" + new URLSearchParams(params) : ""}`),

  getSettings: () => adminFetch<any>("/admin/settings"),
  updateSetting: (key: string, value: string) =>
    adminFetch<any>(`/admin/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
};

export interface BuyOrder {
  id: string;
  title: string;
  amount: string;
  paymentMethod: string;
  upiId?: string | null;
  name?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  description?: string | null;
  isActive: boolean;
  maxClaims?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
