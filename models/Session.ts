import mongoose, { Schema, models } from 'mongoose';

// Re-register in dev to pick up schema changes (fixes stale enum after hot reload)
if (process.env.NODE_ENV === 'development' && models.Session) {
    delete models.Session;
}

const SessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toolType: {
        type: String,
        enum: ['code_review', 'policy_enforcement', 'compliance'],
        required: true
    },
    modelType: {
        type: String,
        enum: ['openai', 'huggingface', 'huggingface_phi3', 'simulated', 'gpt_class', 'open_source'],
        default: 'openai'
    },
    defenseMode: {
        type: String,
        enum: ['passive', 'active', 'strict'],
        default: 'active'
    },
    trustScore: { type: Number, default: 100 },
    intentGraph: { type: Schema.Types.Mixed, default: {} }, // JSON object of the graph
    createdAt: { type: Date, default: Date.now },
});

export default models.Session || mongoose.model('Session', SessionSchema);
