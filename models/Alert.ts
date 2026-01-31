import mongoose, { Schema, models } from 'mongoose';

const AlertSchema = new Schema({
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    turnId: { type: Schema.Types.ObjectId, ref: 'Turn', required: false },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true
    },
    title: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

export default models.Alert || mongoose.model('Alert', AlertSchema);
