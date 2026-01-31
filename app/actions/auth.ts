"use server";

import { cookies } from "next/headers";
import { jwtVerify, JWTPayload } from "jose";
import { getDb } from "@/lib/database";

const JWT_SECRET = process.env.JWT_SECRET;

export async function getCurrentUserAction() {
  const db = await getDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables.");
    }
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload }: { payload: JWTPayload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;

    if (!userId) return null;

    const user = await db.findUserById(userId);

    if (!user) {
      cookieStore.delete("auth_token");
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, otp, otpExpires, ...rest } = user;
    return {
      ...rest,
      name: user.fullName,
    };
  } catch (error) {
    console.error("Authentication error in server action:", error);
    cookieStore.delete("auth_token");
    return null;
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}
