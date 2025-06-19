import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  console.log('createClient', process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = document.cookie
            .split(';')
            .map(cookie => cookie.trim())
            .filter(cookie => cookie.length > 0)
            .map(cookie => {
              const [name, ...valueParts] = cookie.split('=');
              return {
                name: name.trim(),
                value: valueParts.join('=').trim()
              };
            });
          
          console.log('[SupabaseClient] getAll() called, returning cookies:', cookies.length);
          
          // Log the actual cookie values for debugging
          const authCookies = cookies.filter(c => c.name.includes('supabase') || c.name.includes('auth') || c.name.includes('sb-'));
          console.log('[SupabaseClient] All auth-related cookies found:', authCookies.map(c => c.name));
          
          authCookies.forEach(cookie => {
            console.log(`[SupabaseClient] Cookie "${cookie.name}":`, {
              name: cookie.name,
              valueLength: cookie.value?.length || 0,
              valueStart: cookie.value?.substring(0, 50) + '...',
              isTokenCookie: cookie.name.includes('auth-token') && !cookie.name.includes('code-verifier')
            });
          });
          
          // For Docker setup: make kong cookies available as localhost cookies too
          // This allows the browser client to read server-side auth cookies
          const kongCookies = cookies.filter(c => c.name.startsWith('sb-kong-'));
          const localhostCookies = cookies.filter(c => c.name.startsWith('sb-localhost-'));
          
          console.log('[SupabaseClient] Kong cookies found:', kongCookies.length);
          console.log('[SupabaseClient] Localhost cookies found:', localhostCookies.length);
          
          // Create localhost equivalents of kong cookies if they don't exist
          const extraCookies: { name: string; value: string }[] = [];
          kongCookies.forEach(kongCookie => {
            const localhostName = kongCookie.name.replace('sb-kong-', 'sb-localhost-');
            const existingLocalhost = cookies.find(c => c.name === localhostName);
            
            if (!existingLocalhost) {
              console.log(`[SupabaseClient] Creating localhost equivalent for ${kongCookie.name} -> ${localhostName}`);
              extraCookies.push({
                name: localhostName,
                value: kongCookie.value
              });
            }
          });
          
          const allCookies = [...cookies, ...extraCookies];
          console.log('[SupabaseClient] Total cookies returned (including virtual):', allCookies.length);
          
          return allCookies;
        },
        setAll(cookiesToSet) {
          console.log('[SupabaseClient] setAll() called with:', cookiesToSet.length, 'cookies');
          cookiesToSet.forEach(({ name, value, options = {} }) => {
            console.log('[SupabaseClient] Setting cookie:', name, 'value length:', value?.length || 0);
            let cookieString = `${name}=${value}`;
            
            if (options.expires) {
              cookieString += `; expires=${options.expires.toUTCString()}`;
            }
            if (options.maxAge) {
              cookieString += `; max-age=${options.maxAge}`;
            }
            if (options.domain) {
              cookieString += `; domain=${options.domain}`;
            }
            if (options.path) {
              cookieString += `; path=${options.path}`;
            }
            if (options.secure) {
              cookieString += '; secure';
            }
            if (options.httpOnly) {
              cookieString += '; httponly';
            }
            if (options.sameSite) {
              cookieString += `; samesite=${options.sameSite}`;
            }
            
            document.cookie = cookieString;
          });
        },
      },
    }
  );
}
  