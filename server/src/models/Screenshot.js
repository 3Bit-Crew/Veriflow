import mongoose from 'mongoose';

const { Schema } = mongoose;

// Screenshots taken by the checkers, served by GET /api/screenshots/:id
const ScreenshotSchema = new Schema({
  jobId:    { type: Schema.Types.ObjectId, ref: 'Job', index: true },
  viewport: { type: String, enum: ['desktop', 'mobile'] },
  data:     Buffer // JPEG, quality ~60, keep each under ~300KB
}, { timestamps: true });

export default mongoose.model('Screenshot', ScreenshotSchema);
