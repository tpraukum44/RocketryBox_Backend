import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: String,
  url: String
}, { _id: false });

const ticketResponseSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket',
    required: true
  },
  sender: {
    type: String, // 'seller' or 'admin'
    enum: ['seller', 'admin'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  attachments: [attachmentSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TicketResponse', ticketResponseSchema); 