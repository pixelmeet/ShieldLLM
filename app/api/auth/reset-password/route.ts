import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/database";

export async function POST(request: Request) {
  const db = await getDb();

  try {
    const { email, otp, password } = await request.json();

    if (!email || !otp || !password) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    const user = await db.findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { message: "Invalid or expired session" },
        { status: 400 }
      );
    }

    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpires ||
      Date.now() > user.otpExpires
    ) {
      return NextResponse.json(
        { message: "Invalid or expired session" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.updateUser(user.id, {
      passwordHash,
      otp: null,
      otpExpires: null,
    });

    return NextResponse.json(
      { message: "Password reset successful" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}