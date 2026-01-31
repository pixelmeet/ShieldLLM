import mongoose, { Schema, models } from 'mongoose';

const TurnSchema = new Schema({
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    userText: { type: String, required: true },
    primaryOutput: { type: String, default: '' },
    shadowOutput: { type: String, default: '' },
    scores: {
        semanticDrift: { type: Number, default: 0 },
        policyStress: { type: Number, default: 0 },
        reasoningMismatch: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    action: {
        type: String,
        enum: ['allow', 'clarify', 'sanitize_rerun', 'contain'],
        default: 'allow'
    },
    divergenceLog: {
        divergenceScore: { type: Number, default: 0 },
        action: { type: String, default: '' },
        defenseActionTaken: { type: Boolean, default: false },
        rerunWithCleaned: { type: Boolean, default: false }
    },
    sanitizedText: { type: String, default: null },
    latencyMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

export default models.Turn || mongoose.model('Turn', TurnSchema);
