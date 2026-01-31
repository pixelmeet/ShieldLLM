import mongoose, { Schema, models } from 'mongoose';

const SessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toolType: {
        type: String,
        enum: ['code_review', 'policy_enforcement', 'compliance'],
        required: true
    },
    modelType: {
        type: String,
        enum: ['gpt_class', 'open_source'],
        default: 'gpt_class'
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
