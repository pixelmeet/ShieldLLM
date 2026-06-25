import mongoose, { Schema, models } from 'mongoose';

// Re-register in dev to pick up schema changes
if (process.env.NODE_ENV === 'development' && models.User) {
    delete models.User;
}

const UserSchema = new Schema({
    fullName: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'moderator', 'user'],
        default: 'user'
    },
    otp: { type: String },
    otpExpires: { type: Number },
    createdAt: { type: Date, default: Date.now },
});

export default models.User || mongoose.model('User', UserSchema);

