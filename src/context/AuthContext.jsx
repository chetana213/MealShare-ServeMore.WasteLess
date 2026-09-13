import { createContext, useContext, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { useMockAuth, mockLogin } from "../api/axios";

const AuthContext = createContext(null);

const TOKEN_KEY = "mealshare_token";
const USER_KEY = "mealshare_user";

function readStoredUser() {
  try {
    const storedUser = localStorage.getItem(USER_KEY);

    if (!storedUser || storedUser === "null") {
      return null;
    }

    return JSON.parse(storedUser);
  } catch {
    return null;
  }
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: user.role === "donor" ? "Donor" : "Receiver",
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  const [user, setUser] = useState(readStoredUser);

  const login = async (email, password, role = "Receiver") => {
    if (!email || !password) {
      const error = new Error("Email and password are required.");
      toast.error(error.message);
      throw error;
    }

    try {
      let response;

      if (useMockAuth) {
        response = await mockLogin({
          email,
          role,
        });
      } else {
        const apiResponse = await api.post("/auth/login", {
          email,
          password,
        });

        // Axios stores the backend JSON response in apiResponse.data
        response = apiResponse.data;
      }

      const accessToken = response?.token;
      const authenticatedUser = normalizeUser(response?.user);

      if (!accessToken) {
        throw new Error("Login failed: server did not return a token.");
      }

      if (!authenticatedUser) {
        throw new Error("Login failed: server did not return user information.");
      }

      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(
        USER_KEY,
        JSON.stringify(authenticatedUser),
      );

      setToken(accessToken);
      setUser(authenticatedUser);

      toast.success(`Welcome, ${authenticatedUser.name}!`);

      return authenticatedUser;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Login failed.";

      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);

    toast.success("You have been signed out.");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
    }),
    [user, token],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}