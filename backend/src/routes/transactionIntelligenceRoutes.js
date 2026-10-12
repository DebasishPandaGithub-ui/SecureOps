
import { Router } from "express";
import Transaction from "../models/Transaction.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticate);

const HIGH_AMOUNT = Number(process.env.RISK_HIGH_AMOUNT_THRESHOLD) || 10000;
const MEDIUM_AMOUNT = HIGH_AMOUNT / 2;
const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_COUNT = 3;
const MAX_RECORDS = 500;

router.get("/", async (req, res, next) => {
try{
  const canReview =
    req.user.role === "admin" || req.user.role === "manager";

  const filter = canReview
    ? {}
    : { createdBy: req.user.id };

  const transactions = await Transaction.find(filter)
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .limit(MAX_RECORDS)
    .lean();

  // Count recent activity for each creator.
  const byCreator = new Map();

  for (const tx of transactions) {
    const creatorId = tx.createdBy?._id
  ? String(tx.createdBy._id)
  : tx.createdBy
    ? String(tx.createdBy)
    : null;

if (!creatorId) {
  continue;
}

    if (!byCreator.has(creatorId)) {
      byCreator.set(creatorId, []);
    }

    byCreator.get(creatorId).push(tx);
  }

  // Identify creators with at least three transactions
  // within any rolling ten-minute window in the loaded records.
  const burstIds = new Set();

  for (const creatorTransactions of byCreator.values()) {
    const sorted = [...creatorTransactions].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );

    let left = 0;

    for (let right = 0; right < sorted.length; right++) {
      const currentTime = new Date(
        sorted[right].createdAt
      ).getTime();

      while (
        currentTime -
          new Date(sorted[left].createdAt).getTime() >
        BURST_WINDOW_MS
      ) {
        left++;
      }

      if (right - left + 1 >= BURST_COUNT) {
        for (let i = left; i <= right; i++) {
          burstIds.add(String(sorted[i]._id));
        }
      }
    }
  }

  const enrichedTransactions = transactions.map((tx) => {
    const riskReasons = [];
    const amount = Number(tx.amount) || 0;
    const isBurst = burstIds.has(String(tx._id));

    let riskScore = 0;

    if (amount >= HIGH_AMOUNT) {
      riskScore += 50;
      riskReasons.push("Amount exceeds the high-value threshold");
    } else if (amount >= MEDIUM_AMOUNT) {
      riskScore += 30;
      riskReasons.push("Amount exceeds the medium-value threshold");
    }

    if (isBurst) {
      riskScore += 40;
      riskReasons.push(
        "Creator submitted multiple transactions within ten minutes"
      );
    }

    riskScore = Math.min(riskScore, 100);

    const riskLevel =
      riskScore >= 50
        ? "high"
        : riskScore >= 30
          ? "medium"
          : "low";

    return {
      ...tx,
      riskScore,
      riskLevel,
      riskReasons
    };
  });

  const riskCounts = enrichedTransactions.reduce(
    (counts, tx) => {
      counts[tx.riskLevel]++;
      return counts;
    },
    { high: 0, medium: 0, low: 0 }
  );

  return res.json({
    transactions: enrichedTransactions,
    riskCounts,
    recordLimit: MAX_RECORDS,
    returnedCount: enrichedTransactions.length,
    rules: {
      highAmountThreshold: HIGH_AMOUNT,
      mediumAmountThreshold: MEDIUM_AMOUNT,
      burstCount: BURST_COUNT,
      burstWindowMinutes: 10
    }
 });
  } catch (error) {
    next(error);
  }
});

export default router;
