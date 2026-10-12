
import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  Activity,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { api } from "./lib/api";
import "./TransactionIntelligence.css";

type RiskLevel = "low" | "medium" | "high";

type Creator = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
};

type RiskTransaction = {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  createdBy?: Creator | string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
};

type IntelligenceResponse = {
  transactions: RiskTransaction[];
  riskCounts: Record<RiskLevel, number>;
  returnedCount: number;
  recordLimit: number;
  rules: {
    highAmountThreshold: number;
    mediumAmountThreshold: number;
    burstCount: number;
    burstWindowMinutes: number;
  };
};

type Props = {
  token: string;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const creatorInfo = (creator?: Creator | string) => {
  if (!creator) {
    return {
      id: "unknown",
      name: "Unknown creator",
      email: "",
    };
  }

  if (typeof creator === "string") {
    return { id: creator, name: creator, email: "" };
  }

  return {
    id: creator._id || creator.id || "unknown",
    name: creator.name || creator.email || "Unknown creator",
    email: creator.email || "",
  };
};

export default function TransactionIntelligence({
  token,
}: Props) {
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState<RiskTransaction | null>(null);

  async function loadIntelligence() {
    setLoading(true);
    setError("");

    try {
      const response = await api<IntelligenceResponse>(
        "/transaction-intelligence",
        token
      );

      setData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load transaction intelligence."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIntelligence();
  }, [token]);

  const filteredTransactions = useMemo(() => {
    const transactions = data?.transactions ?? [];

    if (riskFilter === "all") return transactions;

    return transactions.filter(
      (transaction) => transaction.riskLevel === riskFilter
    );
  }, [data, riskFilter]);

  const { nodes, edges } = useMemo(() => {
    const visibleTransactions = filteredTransactions.slice(0, 60);
    const creatorMap = new Map<string, Creator>();
    const creatorCounts = new Map<string, number>();

    visibleTransactions.forEach((transaction) => {
      const creator = creatorInfo(transaction.createdBy);
      creatorMap.set(creator.id, {
        _id: creator.id,
        name: creator.name,
        email: creator.email,
      });
      creatorCounts.set(
        creator.id,
        (creatorCounts.get(creator.id) ?? 0) + 1
      );
    });

    const creators = [...creatorMap.entries()];
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    creators.forEach(([creatorId, creator], index) => {
      const angle = (index / Math.max(creators.length, 1)) * Math.PI * 2;

      generatedNodes.push({
        id: `creator-${creatorId}`,
        position: {
          x: 280 + Math.cos(angle) * 260,
          y: 260 + Math.sin(angle) * 200,
        },
        data: {
          label: `${creator.name || "Creator"}\n${creatorCounts.get(creatorId)} transactions`,
        },
        style: {
          width: 190,
          padding: 14,
          borderRadius: 12,
          border: "1px solid #64748b",
          background: "#172033",
          color: "#f8fafc",
          whiteSpace: "pre-line",
          fontSize: 12,
          textAlign: "center",
        },
      });
    });

    visibleTransactions.forEach((transaction, index) => {
      const creator = creatorInfo(transaction.createdBy);
      const riskColor =
        transaction.riskLevel === "high"
          ? "#ef4444"
          : transaction.riskLevel === "medium"
            ? "#f59e0b"
            : "#22c55e";

      const transactionId = `transaction-${transaction._id}`;
      const creatorNodeId = `creator-${creator.id}`;
      const angle = (index / Math.max(visibleTransactions.length, 1)) *
        Math.PI * 2;

      generatedNodes.push({
        id: transactionId,
        position: {
          x: 640 + Math.cos(angle) * 300,
          y: 260 + Math.sin(angle) * 220,
        },
        data: {
          label: `${transaction.title}\n${money(transaction.amount)} · ${transaction.riskLevel.toUpperCase()} risk (${transaction.riskScore})`,
        },
        style: {
          width: 220,
          padding: 12,
          borderRadius: 10,
          border: `2px solid ${riskColor}`,
          background:
            transaction.riskLevel === "high"
              ? "#451a24"
              : transaction.riskLevel === "medium"
                ? "#422d12"
                : "#142f2a",
          color: "#f8fafc",
          whiteSpace: "pre-line",
          fontSize: 11,
          textAlign: "center",
        },
      });

      generatedEdges.push({
        id: `edge-${creator.id}-${transaction._id}`,
        source: creatorNodeId,
        target: transactionId,
        animated: transaction.riskLevel === "high",
        style: {
          stroke: riskColor,
          strokeWidth: transaction.riskLevel === "high" ? 2.5 : 1.5,
        },
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [filteredTransactions]);

  const counts = data?.riskCounts ?? {
    high: 0,
    medium: 0,
    low: 0,
  };

  return (
    <section className="intelligence-page">
      <div className="intelligence-header">
        <div>
          <p className="intelligence-eyebrow">SECUREOPS · ANALYTICS</p>
          <h1>Transaction Intelligence</h1>
          <p className="intelligence-subtitle">
            Explore transaction activity and rule-based risk indicators.
          </p>
        </div>

        <button
          className="intelligence-refresh"
          onClick={() => void loadIntelligence()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="intelligence-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => void loadIntelligence()}>Retry</button>
        </div>
      )}

      <div className="intelligence-stats">
        <article className="intelligence-stat">
          <Activity size={20} />
          <span>Transactions analyzed</span>
          <strong>{data?.returnedCount ?? 0}</strong>
        </article>

        <article className="intelligence-stat risk-high">
          <AlertTriangle size={20} />
          <span>High risk</span>
          <strong>{counts.high}</strong>
        </article>

        <article className="intelligence-stat risk-medium">
          <TrendingUp size={20} />
          <span>Medium risk</span>
          <strong>{counts.medium}</strong>
        </article>

        <article className="intelligence-stat risk-low">
          <ShieldCheck size={20} />
          <span>Low risk</span>
          <strong>{counts.low}</strong>
        </article>
      </div>

      <div className="intelligence-panel">
        <div className="intelligence-panel-header">
          <div>
            <h2>Activity relationship graph</h2>
            <p>
              Select a transaction node to inspect its risk indicators.
            </p>
          </div>

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            aria-label="Filter transactions by risk"
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
          </select>
        </div>

        {loading && !data ? (
          <div className="intelligence-state">
            Loading transaction intelligence...
          </div>
        ) : !error && filteredTransactions.length === 0 ? (
          <div className="intelligence-state">
            No transactions match this filter.
          </div>
        ) : (
          <>
            <div className="intelligence-graph">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.15}
                maxZoom={1.8}
                onNodeClick={(_, node) => {
                  if (node.id.startsWith("transaction-")) {
                    const id = node.id.replace("transaction-", "");
                    const transaction = filteredTransactions.find(
                      (item) => item._id === id
                    );
                    setSelected(transaction ?? null);
                  } else {
                    setSelected(null);
                  }
                }}
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>

            {filteredTransactions.length > 60 && (
              <p className="intelligence-note">
                Showing 60 graph transactions for responsiveness out of{" "}
                {filteredTransactions.length} matching records. Risk counts
                include all returned records.
              </p>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="intelligence-panel intelligence-details">
          <div className="intelligence-panel-header">
            <div>
              <h2>{selected.title}</h2>
              <p>{selected.description || "No description provided."}</p>
            </div>
            <button
              className="intelligence-close"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>

          <div className="intelligence-detail-grid">
            <div>
              <span>Amount</span>
              <strong>{money(selected.amount)}</strong>
            </div>
            <div>
              <span>Risk score</span>
              <strong>
                {selected.riskScore}/100 · {selected.riskLevel.toUpperCase()}
              </strong>
            </div>
            <div>
              <span>Transaction status</span>
              <strong>{selected.status}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{new Date(selected.createdAt).toLocaleString()}</strong>
            </div>
          </div>

          <h3>Risk indicators</h3>
          {selected.riskReasons.length ? (
            <ul className="intelligence-reasons">
              {selected.riskReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>No configured risk rules were triggered.</p>
          )}
        </div>
      )}

      {data && (
        <p className="intelligence-disclaimer">
          Risk scores are heuristic indicators based on configured rules.
          They are not proof of fraud. Amount thresholds:{" "}
          {money(data.rules.mediumAmountThreshold)} medium and{" "}
          {money(data.rules.highAmountThreshold)} high. Burst rule:{" "}
          {data.rules.burstCount} or more transactions within{" "}
          {data.rules.burstWindowMinutes} minutes.
        </p>
      )}
    </section>
  );
}
