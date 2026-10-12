import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import transactionIntelligenceRoutes from "./routes/transactionIntelligenceRoutes.js";
const app = express();
const port = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required. Copy .env.example to .env and configure it.");
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes("replace_with")) {
  throw new Error("JWT_SECRET must be a unique random secret of at least 32 characters.");
}
if (isProduction && !process.env.CLIENT_ORIGIN) {
  throw new Error("CLIENT_ORIGIN must be set to the exact trusted frontend origin in production.");
}

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
if (allowedOrigins.includes("*")) throw new Error("Wildcard CLIENT_ORIGIN is not allowed. Use explicit trusted origins.");

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(cors({
  origin(origin, callback) {
    // Non-browser requests without Origin are allowed; CORS is not authentication.
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
}));
app.use(express.json({ limit: "100kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));

// Require JSON objects on write requests to avoid undefined/null body crashes.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) &&
      (req.body === undefined || req.body === null || Array.isArray(req.body) || typeof req.body !== "object")) {
    return res.status(400).json({ message: "A JSON object request body is required." });
  }
  return next();
});

function createRateLimiter({ windowMs, limit, message }) {
  const hits = new Map();
  let requestsSinceCleanup = 0;
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = hits.get(key);
    if (!entry && hits.size >= 10000) hits.delete(hits.keys().next().value);
    if (!entry || now >= entry.resetAt) entry = { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 256) {
      for (const [ip, value] of hits) if (now >= value.resetAt) hits.delete(ip);
      requestsSinceCleanup = 0;
    }
    if (entry.count > limit) return res.status(429).json({ message });
    return next();
  };
}
const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 300, message: "Too many requests. Please try again later." });

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many authentication attempts. Please try again later."
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many registration attempts. Please try again later."
});
app.use("/api", apiLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/login", authLimiter);


app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected", service: "SecureOps API" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/transaction-intelligence", transactionIntelligenceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use((_req, res) => res.status(404).json({ message: "Route not found." }));
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
  if (error?.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large." });
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ message: "Malformed JSON request body." });
  if (error?.name === "ValidationError" || error?.name === "CastError") return res.status(400).json({ message: "Invalid request data." });
  console.error("Unhandled API error:", error?.message || error);
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("MongoDB connected");
  app.listen(port, () => console.log(`SecureOps API listening on port ${port}`));
} catch (error) {
  console.error("Unable to connect to MongoDB. Verify MONGO_URI and database network access:", error.message);
  process.exit(1);
}
