import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthCookieName, isAdminAuthConfigured, verifyAdminSessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
    // Simple path exclusion (like public assets or the login page itself)
    if (
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/api/auth') ||
        request.nextUrl.pathname === '/favicon.ico' ||
        request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/icon.png'
    ) {
        return NextResponse.next();
    }

    if (!isAdminAuthConfigured()) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    const authCookie = request.cookies.get(getAuthCookieName());
    const isAuthenticated = await verifyAdminSessionToken(authCookie?.value);

    if (!isAuthenticated) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
