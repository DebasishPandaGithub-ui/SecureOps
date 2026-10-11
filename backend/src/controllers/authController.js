import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt
});

function createToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h", algorithm: "HS256", issuer: "secureops-api", audience: "secureops-client" });
}

export async function register(req, res) {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Name must be between 2 and 80 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ message: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." });

  const exists = await User.exists({ email });
  if (exists) return res.status(409).json({ message: "An account with this email already exists." });

  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: "user" });
  return res.status(201).json({ token: createToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  return res.json({ token: createToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "Account not found." });
  return res.json({ user: publicUser(user) });
}
