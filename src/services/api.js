import axios from "axios";

const TOKEN_KEY = "mealshare_token";
const USER_KEY = "mealshare_user";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function saveSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  return error.response?.data?.message || fallback;
}

export const authApi = {
  register: (details) => api.post("/auth/register", details),
  login: (details) => api.post("/auth/login", details),
  me: () => api.get("/auth/me"),
};

export const foodApi = {
  getAll: () => api.get("/foods"),
  create: (food) => api.post("/foods", food),
  claim: (foodId) => api.post(`/foods/${foodId}/claim`),
};

export const analyticsApi = {
  get: () => api.get("/analytics"),
};
