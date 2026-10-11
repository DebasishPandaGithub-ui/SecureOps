import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = Router();
router.use(authenticate, authorize("admin"));

router.get("/", async (_req, res) => {
  const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 }).lean();
  res.json({ users });
});

router.patch("/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user ID." });
  if (!["admin", "manager", "user"].includes(role)) return res.status(400).json({ message: "Role must be admin, manager, or user." });
  if (id === req.user.id) return res.status(400).json({ message: "You cannot change your own role." });
  const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).select("name email role createdAt");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user });
});

export default router;
