import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  amount: { type: Number, required: true, min: 0.01 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true, versionKey: false });

transactionSchema.index({ createdBy: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model("Transaction", transactionSchema);
