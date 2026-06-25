import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbConnect from '@backend/lib/db';
import User from '@backend/models/User';
import { clearSession, getSession } from '@backend/lib/auth';

const SECRET_KEY = process.env.AUTH_SECRET || 'secret';

export async function POST(req: Request) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { email, password } = body;
    if (!email || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      console.warn(`[auth/login] Failed login attempt for non-existent email: ${email.trim().toLowerCase()}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare password using bcrypt (matches signup which hashes with bcrypt)
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      console.warn(`[auth/login] Failed login attempt for email: ${email.trim().toLowerCase()}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const userId = user.get('id') || user._id.toString();
    const token = jwt.sign({ userId, role: user.role }, SECRET_KEY, { expiresIn: '1d' });

    const response = NextResponse.json({ success: true, role: user.role });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 86400,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  // Check if logged in
  const session = await getSession();
  if (session) {
    return NextResponse.json({ authenticated: true, user: session });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
