import mongoose from 'mongoose';

const { Schema } = mongoose;

// Audit log, shown in the AG Grid dashboard. Create these with logEvent() in events.js.
const EventSchema = new Schema({
  jobId:   { type: Schema.Types.ObjectId, ref: 'Job', index: true },
  type:    String, // one of the event types in PLAN.md 5.7
  message: String, // human-readable, shown in the grid
  data:    Object  // extra details, e.g. PayPal response ids
}, { timestamps: true });

export default mongoose.model('Event', EventSchema);
