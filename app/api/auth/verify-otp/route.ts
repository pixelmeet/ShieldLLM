import { NextResponse } from "next/server";
import { getDb } from "@/lib/database";

export async function POST(request: Request) {
  const db = await getDb();

  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { message: "Email and OTP required" },
        { status: 400 }
      );
    }

    const user = await db.findUserByEmail(email);

    if (!user || !user.otp || !user.otpExpires) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    if (Date.now() > user.otpExpires) {
      return NextResponse.json({ message: "OTP has expired" }, { status: 400 });
    }

    if (user.otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 400 });
    }

    return NextResponse.json({ message: "OTP verified" }, { status: 200 });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}