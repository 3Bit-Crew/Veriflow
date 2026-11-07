import mongoose from 'mongoose';

const { Schema } = mongoose;

// One item of the buyer's checklist. Each item gets an automatic _id;
// that _id (as a string) is the "itemId" used everywhere (PLAN.md 5.2).
const ChecklistItemSchema = new Schema({
  text:       { type: String, required: true },     // "Signup form has an email field"
  kind:       { type: String, required: true },     // see PLAN.md 5.3
  params:     { type: Object, default: {} },        // settings for the checker
  weight:     { type: Number, required: true },     // whole numbers, all weights add up to 100
  status:     { type: String, default: 'PENDING' }, // PENDING | PASS | FAIL | UNSURE
  confidence: Number,                               // 0.0 – 1.0
  reasoning:  String,                               // why it passed or failed
  evidence:   { screenshots: [String], logUrl: String } // screenshots = Screenshot ids
});

const JobSchema = new Schema({
  title:         { type: String, required: true },
  description:   { type: String, required: true },  // buyer's plain-English request
  type:          { type: String, enum: ['code', 'website'], required: true },
  repoUrl:       String,                             // code jobs only: https://github.com/owner/repo
  amount:        { type: Number, required: true },   // e.g. 200 (USD)
  currency:      { type: String, default: 'USD' },
  buyerEmail:    String,                             // sandbox personal account
  workerEmail:   { type: String, required: true },   // sandbox business account (payee)
  status:        { type: String, default: 'DRAFT' },
  paypalOrderId: String,
  paypalAuthId:  String,
  submissionUrl: String,                             // PR URL (code) or website URL (website)
  attempts:      { type: Number, default: 0 },       // how many times the work was checked
  payoutAmount:  Number,                             // set when SETTLED
  settlement:    { type: String, enum: ['FULL', 'PARTIAL', 'VOID'] }, // set when SETTLED
  items:         [ChecklistItemSchema]
}, { timestamps: true });

export default mongoose.model('Job', JobSchema);
