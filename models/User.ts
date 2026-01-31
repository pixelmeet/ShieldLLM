import mongoose, { Schema, models } from 'mongoose';

const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: ['developer', 'security_engineer', 'admin'],
        default: 'developer'
    },
    createdAt: { type: Date, default: Date.now },
});

export default models.User || mongoose.model('User', UserSchema);
