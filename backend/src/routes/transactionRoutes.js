import { Router } from "express";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate);
const canReview = (role) => role === "admin" || role === "manager";

router.get("/", async (req, res) => {
  const filter = canReview(req.user.role) ? {} : { createdBy: req.user.id };
  const transactions = await Transaction.find(filter)
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ transactions });
});

router.post("/", async (req, res) => {
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const amount = Number(req.body.amount);
  if (title.length < 2 || title.length > 140) return res.status(400).json({ message: "Title must be between 2 and 140 characters." });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Amount must be a number greater than zero." });
  if (description.length > 1000) return res.status(400).json({ message: "Description cannot exceed 1000 characters." });

  const transaction = await Transaction.create({ title, description, amount, createdBy: req.user.id });
  await transaction.populate("createdBy", "name email");
  res.status(201).json({ transaction });
});

router.patch("/:id/status", authorize("admin", "manager"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be approved or rejected." });
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ message: "Transaction not found." });
  if (transaction.status !== "pending") return res.status(409).json({ message: "Only pending transactions can be reviewed." });
  transaction.status = status;
  await transaction.save();
  await transaction.populate("createdBy", "name email");
  res.json({ transaction });
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ message: "Transaction not found." });
  const isOwner = transaction.createdBy.toString() === req.user.id;
  if (!isOwner && req.user.role !== "admin") return res.status(403).json({ message: "You cannot delete this transaction." });
  if (transaction.status !== "pending" && req.user.role !== "admin") return res.status(409).json({ message: "Only pending transactions can be deleted by their owner." });
  await transaction.deleteOne();
  res.json({ message: "Transaction deleted." });
});

export default router;
