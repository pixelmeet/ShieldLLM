import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { UserRole, canAccessRole } from "@/types/roles";

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;

  const isAdminPath = pathname.startsWith("/admin");
  const isUserPath = pathname.startsWith("/user");
  const isModeratorPath = pathname.startsWith("/moderator");

  if (isAdminPath || isUserPath || isModeratorPath) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      if (!JWT_SECRET) throw new Error("JWT_SECRET missing");
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const userRole = payload.role as UserRole;

      if (isAdminPath && !canAccessRole(userRole, "admin")) {
        return NextResponse.redirect(new URL("/user", request.url));
      }

      if (isModeratorPath && !canAccessRole(userRole, "moderator")) {
        return NextResponse.redirect(new URL("/user", request.url));
      }

      return NextResponse.next();
    } catch (err) {
      console.error("Middleware JWT Error:", err);

      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/moderator/:path*"],
};