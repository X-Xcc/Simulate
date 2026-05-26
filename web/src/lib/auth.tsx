import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { getToken, clearToken } from "./api";

interface AuthCtx {
  authenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  authenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => {
    // Mock 模式：检查 localStorage
    if (localStorage.getItem("mock_auth") === "true") return true;
    return !!getToken();
  });

  const login = useCallback(() => {
    localStorage.setItem("mock_auth", "true");
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("mock_auth");
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    const handler = () => {
      // Mock 模式下不踢回登录页 — 无 JWT 所以 API 必然 401
      if (localStorage.getItem("mock_auth") === "true") return;
      setAuthenticated(false);
    };
    window.addEventListener("rtk:token-invalid", handler);
    return () => window.removeEventListener("rtk:token-invalid", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
