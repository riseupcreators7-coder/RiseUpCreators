import {QueryClient,QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function APIRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Always get fresh auth token for authenticated endpoints
  const token = localStorage.getItem('ruc_auth_token');
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // Always include auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.debug('🔑API Request with auth:', method, url, 'Token present:', !!token);
  } else {
    console.debug('🔓API Request without auth:', method, url);
  }

  console.log('🌐 Making API request:', {
    method,
    url,
    hasData: !!data,
    headers: Object.keys(headers),
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    userAgent: navigator.userAgent.substring(0, 50) + '...'
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log('📡 API response:', {
      method,
      url,
      status: res.status,
      statusText: res.statusText,
      ok: res.ok
    });
  } catch (fetchError) {
    console.error('🚫 Fetch error:', {
      method,
      url,
      error: fetchError,
      isMobile: /Mobi|Android/i.test(navigator.userAgent)
    });
    throw fetchError;
  }

  // Enhanced error handling for auth issues
  if (res.status === 401 || res.status === 403) {
    console.warn('Authentication failed for:', method, url, 'Status:', res.status);
    // Don't automatically clear auth here - let the auth context handle it
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) =>QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Only use the first element as the URL, ignore cache parameters
    const url = queryKey[0] as string;
    
    // Always get fresh auth token for authenticated endpoints
    const token = localStorage.getItem('ruc_auth_token');
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.debug('🔑Query with auth:', url, 'Token present:', !!token);
    } else {
      console.debug('🔓Query without auth:', url);
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.warn('Query auth failed, returning null:', url);
      return null;
    }

    if (res.status === 401 || res.status === 403) {
      console.warn('QueryAuthentication failed for:', url, 'Status:', res.status);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: (failureCount, error) => {
        // Don't retry on auth errors (401, 403)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status === 401 || status === 403) {
            return false;
          }
        }
        // Retry up to 1 time for other errors to prevent loops
        return failureCount < 1;
      },
      retryDelay: 1000, // Simple 1 second delay
    },
    mutations: {
      retry: false,
    },
  },
});
