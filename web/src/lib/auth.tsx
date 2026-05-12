import { createContext, useContext, useState, useCallback, ReactNode } from "react";
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
  const [authenticated, setAuthenticated] = useState(() => !!getToken());

  const login = useCallback(() => setAuthenticated(true), []);
  const logout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
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
