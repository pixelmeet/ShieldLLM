/**
 * Seed script: Creates the admin user from .env credentials.
 * Run with: npx tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shieldllm';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@shield.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ShieldDemo2025!';

async function seedAdmin() {
    console.log('[seed] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[seed] Connected.');

    const db = mongoose.connection.db;
    if (!db) {
        console.error('[seed] No database connection');
        process.exit(1);
    }
    const usersCollection = db.collection('users');

    // Check if admin already exists
    const existing = await usersCollection.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existing) {
        console.log(`[seed] Admin user already exists: ${ADMIN_EMAIL}`);
        await mongoose.disconnect();
        return;
    }

    // Create admin user with bcrypt-hashed password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await usersCollection.insertOne({
        fullName: 'System Admin',
        email: ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: 'admin',
        createdAt: new Date(),
    });

    console.log(`[seed] ✅ Admin user created: ${ADMIN_EMAIL}`);
    console.log(`[seed]    Password: ${ADMIN_PASSWORD}`);
    console.log(`[seed]    Role: admin`);

    await mongoose.disconnect();
    console.log('[seed] Done.');
}

seedAdmin().catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
});

