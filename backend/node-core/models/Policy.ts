import mongoose, { Schema, models } from 'mongoose';

const PolicySchema = new Schema({
    divergenceThresholds: {
        low: { type: Number, default: 10 },
        medium: { type: Number, default: 30 },
        high: { type: Number, default: 60 },
        critical: { type: Number, default: 85 }
    },
    trustDecay: { type: Number, default: 5 },
    shadowEnabled: { type: Boolean, default: true },
    defenseModeDefault: {
        type: String,
        enum: ['passive', 'active', 'strict'],
        default: 'active'
    },
});

export default models.Policy || mongoose.model('Policy', PolicySchema);
