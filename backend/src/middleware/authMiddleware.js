import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) return res.status(401).json({ message: "Authentication required." });

  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "secureops-api",
      audience: "secureops-client"
    });
  } catch {
    return res.status(401).json({ message: "Session is invalid or expired. Please sign in again." });
  }

  if (!payload || typeof payload !== "object" || typeof payload.id !== "string") {
    return res.status(401).json({ message: "Session is invalid. Please sign in again." });
  }

  try {
    const user = await User.findById(payload.id).select("role").lean();
    if (!user) return res.status(401).json({ message: "Account no longer exists." });
    req.user = { id: payload.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
}
