import { Router } from "express";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate);
router.get("/summary", async (req, res) => {
  const canReview = req.user.role === "admin" || req.user.role === "manager";
  const match = canReview ? {} : { createdBy: new mongoose.Types.ObjectId(req.user.id) };
  const [groups, totalTransactions, usersCount] = await Promise.all([
    Transaction.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }]),
    Transaction.countDocuments(match),
    req.user.role === "admin" ? User.countDocuments() : Promise.resolve(null)
  ]);
  const summary = { totalTransactions, pending: 0, approved: 0, rejected: 0, totalAmount: 0, approvedAmount: 0, usersCount };
  for (const group of groups) {
    summary[group._id] = group.count;
    summary.totalAmount += group.amount;
    if (group._id === "approved") summary.approvedAmount = group.amount;
  }
  res.json({ summary });
});
export default router;
