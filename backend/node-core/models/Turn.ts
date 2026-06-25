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
        enum: ['low', 'medium', 'high', 'critical', 'unknown'],
        default: 'low'
    },
    action: {
        type: String,
        enum: ['allow', 'clarify', 'sanitize_rerun', 'contain', 'unverified'],
        default: 'allow'
    },
    divergenceLog: {
        divergenceScore: { type: Number, default: 0 },
        action: { type: String, default: '' },
        defenseActionTaken: { type: Boolean, default: false },
        rerunWithCleaned: { type: Boolean, default: false },
        primary_ok: { type: Boolean },
        shadow_ok: { type: Boolean },
        primary_error: { type: String },
        shadow_error: { type: String },
        llm_mode: { type: String }
    },
    sanitizedText: { type: String, default: null },
    latencyMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

// Clear Mongoose cache for hot reloading
delete mongoose.models.Turn;
export default mongoose.model('Turn', TurnSchema);
