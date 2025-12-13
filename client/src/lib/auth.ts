import { APIRequest } from "./queryClient";
import { STORAGE_KEYS } from "./constants";
import type { CurrentUser, LoginForm, SignupForm } from "../types";

export interface AuthResponse {
  user: CurrentUser;
  token: string;
}

export const authApi = {
  login: async (credentials: LoginForm): Promise<AuthResponse> => {
    console.log('🔐 Starting login process...');
    
    // Normalize email to lowercase and trim whitespace
    const normalizedCredentials = {
      ...credentials,
      email: credentials.email.toLowerCase().trim()
    };
    
    console.log('📱 Device info:', {
      userAgent: navigator.userAgent,
      isMobile: /Mobi|Android/i.test(navigator.userAgent),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      credentials: { 
        originalEmail: credentials.email,
        normalizedEmail: normalizedCredentials.email, 
        passwordLength: credentials.password?.length 
      }
    });
    
    // Clear any existing auth state first
    authApi.clearAuthState();
    
    const response = await APIRequest("POST", "/api/auth/login", normalizedCredentials);
    const data = await response.json();

    // Transform user data to match CurrentUser type
    const transformedUser: CurrentUser = {
      _id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatarUrl: data.user.avatarUrl,
      plan: data.user.plan,
      favorites: data.user.favorites,
      following: data.user.following,
    };

    // Store auth data immediately
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(transformedUser));
    
    console.log('✅ Auth data stored, user:', transformedUser.name, 'role:', transformedUser.role);

    // Verify token is working immediately
    authApi.refreshAuthHeaders();

    // Start analytics session
    try {
      const sessionRes = await fetch('/api/analytics/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({
          userId: transformedUser._id,
          deviceInfo: {
            type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            os: navigator.platform,
            browser: navigator.userAgent,
            userAgent: navigator.userAgent
          }
        })
      });
      const sessionJson = await sessionRes.json();
      if (sessionJson?.sessionId) {
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionJson.sessionId);
        console.log('✅ Analytics session created:', sessionJson.sessionId);
      }
    } catch (e) {
      console.warn('⚠️ Failed to start analytics session on login', e);
    }

    // Track login analytics
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        userId: transformedUser._id,
        action: 'login',
        context: 'auth_system',
        metadata: {
          role: transformedUser.role,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      })
    }).catch(error => console.error('Login analytics failed:', error));

    console.log('✅ Login process completed');
    return { user: transformedUser, token: data.token };
  },

  signup: async (userData: SignupForm): Promise<AuthResponse> => {
    // Normalize email for consistent storage
    const normalizedUserData = {
      ...userData,
      email: userData.email.toLowerCase().trim()
    };
    
    const response = await APIRequest("POST", "/api/auth/signup", {
      name: normalizedUserData.name,
      email: normalizedUserData.email,
      password: normalizedUserData.password,
      role: "fan" // Default role for new signups
    });
    const data = await response.json();

    // Transform user data to match CurrentUser type
    const transformedUser: CurrentUser = {
      _id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatarUrl: data.user.avatarUrl,
      plan: data.user.plan,
      favorites: data.user.favorites,
      following: data.user.following,
    };

    // Store auth data
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(transformedUser));

    // Start analytics session
    try {
      const sessionRes = await fetch('/api/analytics/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({
          userId: transformedUser._id,
          deviceInfo: {
            type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            os: navigator.platform,
            browser: navigator.userAgent,
            userAgent: navigator.userAgent
          }
        })
      });
      const sessionJson = await sessionRes.json();
      if (sessionJson?.sessionId) {
        localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionJson.sessionId);
      }
    } catch (e) {
      console.warn('Failed to start analytics session on signup', e);
    }

    // Track signup analytics
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        userId: transformedUser._id,
        action: 'signup',
        context: 'auth_system',
        metadata: {
          role: transformedUser.role,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      })
    }).catch(error => console.error('Signup analytics failed:', error));

    return { user: transformedUser, token: data.token };
  },

  logout: async () => {
    console.log('🔐 Starting logout process...');
    
    // Get current auth data before clearing
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    
    // End analytics session if exists
    if (token && sessionId) {
      try {
        fetch(`/api/analytics/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      } catch (error) {
        console.warn('Analytics session cleanup failed:', error);
      }
    }

    // Call server logout to clear session
    if (token) {
      try {
        await APIRequest("POST", "/api/auth/logout");
        console.log('✅ Server logout completed');
      } catch (error) {
        console.warn("❌ Server logout failed:", error);
      }
    }

    // Clear ALL local storage related to auth and app state
    console.log('🧹 Clearing local storage...');
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CART_ITEMS);
    
    // Clear session storage as well to be thorough
    sessionStorage.clear();
    
    console.log('✅ Logout process completed');
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    // Normalize email for forgot password
    const normalizedEmail = email.toLowerCase().trim();
    const response = await APIRequest("POST", "/api/auth/forgot-password", { email: normalizedEmail });
    return response.json();
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    const response = await APIRequest("GET", "/api/users/me");
    const user = await response.json();

    // Transform the response to match CurrentUser type
    const transformedUser: CurrentUser = {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      favorites: user.favorites,
      following: user.following,
    };

    // Update stored user data
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(transformedUser));

    return transformedUser;
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  getStoredUser: (): CurrentUser | null => {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const user = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return !!(token && user);
  },

  hasRole: (role: string): boolean => {
    const user = authApi.getStoredUser();
    return user?.role === role;
  },

  updateProfile: async (updates: Partial<CurrentUser>): Promise<CurrentUser> => {
    const response = await APIRequest("PATCH", "/api/users/me", updates);
    const user = await response.json();

    // Transform the response to match CurrentUser type
    const transformedUser: CurrentUser = {
      _id: user.id || user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      favorites: user.favorites,
      following: user.following,
    };

    // Update stored user data
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(transformedUser));

    return transformedUser;
  },

  followArtist: async (artistId: string): Promise<{ following: boolean }> => {
    const response = await APIRequest("POST", `/api/users/follow/${artistId}`);
    return response.json();
  },

  // Token validation and management
  validateToken: async (): Promise<boolean> => {
    const token = authApi.getStoredToken();
    if (!token) return false;
    
    try {
      await APIRequest("GET", "/api/users/me");
      return true;
    } catch (error) {
      console.warn("Token validation failed:", error);
      return false;
    }
  },

  clearAuthState: () => {
    console.log('🔄 Clearing all auth state...');
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
    sessionStorage.clear();
  },

  refreshAuthHeaders: () => {
    // Force refresh of auth headers in API calls
    const token = authApi.getStoredToken();
    console.log('🔄 Refreshing auth headers with token:', token ? 'present' : 'missing');
    return token;
  }
};

// Auth helper functions
export const getAuthHeaders = (): Record<string, string> => {
  const token = authApi.getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const requireAuth = () => {
  if (!authApi.isAuthenticated()) {
    // Instead of redirecting, we'll let the component handle showing the auth modal
    return false;
  }
  return true;
};

export const requireRole = (requiredRole: string) => {
  if (!authApi.isAuthenticated()) {
    // Instead of redirecting, we'll let the component handle showing the auth modal
    return false;
  }

  if (!authApi.hasRole(requiredRole)) {
    // Don't redirect here, let the component handle it
    // This will be handled by the useRequireRole hook instead
    return false;
  }

  return true;
};

export const redirectAfterAuth = (user: CurrentUser, setLocation?: (path: string) => void) => {
  // Use router navigation if available, otherwise fall back to window.location
  const navigate = setLocation || ((path: string) => { window.location.href = path; });
  
  // Redirect to appropriate dashboard based on role
  switch (user.role) {
    case "artist":
      navigate("/creator");
      break;
    case "admin":
      navigate("/admin");
      break;
    case "fan":
      navigate("/home");
      break;
    default:
      navigate("/");
  }
};
