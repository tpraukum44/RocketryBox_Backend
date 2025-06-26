import mongoose from 'mongoose';

const verificationTokenSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['register', 'login', 'reset', 'verify'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Document will be automatically deleted after 10 minutes
    }
});

// Create indexes for common queries
verificationTokenSchema.index({ identifier: 1, type: 1 });
// TTL index for automatic document expiration
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

export default VerificationToken; 