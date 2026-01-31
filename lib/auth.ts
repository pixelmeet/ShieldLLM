import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import dbConnect from './db';
import User from '@/models/User';

const SECRET_KEY = process.env.AUTH_SECRET || 'secret';

export async function createSession(userId: string, role: string) {
    const token = jwt.sign({ userId, role }, SECRET_KEY, { expiresIn: '1d' });
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) return null;

    try {
        const payload = jwt.verify(token, SECRET_KEY) as any;
        return payload;
    } catch (err) {
        return null;
    }
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
}

export async function requireAuth(roles: string[] = []) {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }
    if (roles.length > 0 && !roles.includes(session.role)) {
        throw new Error("Forbidden");
    }
    return session;
}
