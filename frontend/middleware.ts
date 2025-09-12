import { type NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/utils/api/backend-interface";

export async function middleware(request: NextRequest) {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const backend = getBackend();
    
    // Check if user is authenticated for protected routes
    const { data: { user }, error } = await backend.auth.getUser();

    // protected routes
    if (request.nextUrl.pathname.startsWith("/dashboard") && (error || !user)) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    if (request.nextUrl.pathname === "/" && !error && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  } catch (e) {
    // If backend is not initialized, allow the request to continue
    console.warn('Backend not initialized in middleware:', e);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
