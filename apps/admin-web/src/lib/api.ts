// API client for communicating with the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      credentials: "include", // Include cookies for auth
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// API endpoints
export const api = {
  // Auth endpoints
  auth: {
    login: (password: string) =>
      apiClient.post("/api/auth/login", { password }),
    logout: () => apiClient.post("/api/auth/logout"),
    status: () => apiClient.get("/api/auth/status"),
  },

  // Admin endpoints
  admin: {
    // Target management
    targets: {
      list: (params?: {
        page?: number;
        limit?: number;
        search?: string;
        unsynced?: boolean;
        isRoot?: boolean;
      }) =>
        apiClient.get(
          `/api/admin/targets?${new URLSearchParams(
            params as Record<string, string>
          ).toString()}`
        ),
      get: (fid: number) => apiClient.get(`/api/admin/targets/${fid}`),
      create: (data: { fid: number; isRoot: boolean }) =>
        apiClient.post("/api/admin/targets", data),
      update: (fid: number, data: { isRoot?: boolean }) =>
        apiClient.put(`/api/admin/targets/${fid}`, data),
      delete: (fid: number) => apiClient.delete(`/api/admin/targets/${fid}`),
      backfill: (fid: number) =>
        apiClient.post(`/api/admin/targets/${fid}/backfill`),
      stats: (fid: number) => apiClient.get(`/api/admin/targets/${fid}/stats`),
    },

    // Client target management
    clientTargets: {
      list: () => apiClient.get("/api/admin/client-targets"),
      create: (fid: number) =>
        apiClient.post("/api/admin/client-targets", { clientFid: fid }),
      delete: (fid: number) =>
        apiClient.delete(`/api/admin/client-targets/${fid}`),
    },

    // Job management
    jobs: {
      list: () => apiClient.get("/api/admin/jobs"),
      backfill: () => apiClient.post("/api/admin/jobs/backfill"),
      stats: (queue?: string) =>
        apiClient.get(
          queue ? `/api/admin/jobs/${queue}/stats` : "/api/admin/jobs"
        ),
    },

    // System health
    health: {
      check: () => apiClient.get("/health"),
      stats: () => apiClient.get("/api/admin/stats"),
      realtime: () => apiClient.get("/api/admin/stats/realtime"),
    },
  },

  // Public endpoints
  public: {
    feed: (fid: number) => apiClient.get(`/api/v1/feed/${fid}`),
    cast: (hash: string) => apiClient.get(`/api/v1/casts/${hash}`),
    user: (fid: number) => apiClient.get(`/api/v1/users/${fid}`),
  },
};
