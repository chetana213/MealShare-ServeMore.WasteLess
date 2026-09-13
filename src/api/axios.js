import axios from "axios";

// Keep mock authentication explicit so a real backend can be enabled later.
export const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH !== "false";

export async function mockLogin({ email, role = "Receiver" }) {
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  const user = {
    id: `demo-${Date.now()}`,
    name: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    email,
    role,
  };
  // JWT-shaped demo value only. It is intentionally not valid for a backend.
  const token = `demo.${btoa(JSON.stringify({ sub: user.id, role }))}.signature`;
  return { token, user };
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mealshare_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mealshare_token");
      localStorage.removeItem("mealshare_user");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

export default api;
