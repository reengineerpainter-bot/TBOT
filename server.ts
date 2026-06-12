import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { rateLimit } from "express-rate-limit";

dotenv.config();

interface WebhookLog {
  id: string;
  type: "confirmation" | "entry" | "tp" | "sl" | "breakeven" | "error" | "info";
  message: string;
  time: string;
  price: number;
  direction?: "BUY" | "SELL";
  lots?: number[];
  sl?: number;
  tp1?: number;
  tp2?: number;
  spread?: number;
}

const app = express();
const PORT = 3000;

// Enable trust proxy so express-rate-limit can accurately detect client IP addresses behind reverse proxies
app.set("trust proxy", 1);

// Webhook notification logs in memory
let webhookLogs: WebhookLog[] = [
  {
    id: "init-1",
    type: "info",
    message: "XAUUSD EMA Bot Webhook Server started successfully.",
    time: new Date().toISOString(),
    price: 0,
    spread: 0,
  }
];

// Security: Rate limiter to protect against DDoS or automation attacks on public web
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again in 15 minutes."
  }
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 webhook hits per minute (plenty for high speed EA trading)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Rate limit exceeded. Maximum 60 requests per minute allowed on this webhook."
  }
});

// Apply rate limiting
app.use("/api/", generalRateLimiter);
app.use(express.json());

// Helper middleware to validate the secure WEBHOOK_SECRET webhook token
const authenticateWebhook = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secretKey = process.env.WEBHOOK_SECRET || "XAUUSD_METABOT_SECURE_TOKEN_2026";
  const apiKeyHeader = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];

  let incomingToken = "";
  if (typeof apiKeyHeader === "string") {
    incomingToken = apiKeyHeader;
  } else if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    incomingToken = authHeader.substring(7);
  }

  if (incomingToken !== secretKey) {
    console.warn(`[Security Alert] Unauthenticated access block on POST /api/webhook from IP: ${req.ip}`);
    
    // Push the warning event directly onto the dashboard log buffer so the trader sees the alert in real-time!
    const alertLog: WebhookLog = {
      id: `sec-${Date.now()}`,
      type: "error",
      message: `🛑 BLOCKED INTRUDER: Unauthenticated request from IP ${req.ip} filtered. Headers lacked original validation token matching WEBHOOK_SECRET.`,
      time: new Date().toISOString(),
      price: 0,
    };
    webhookLogs.unshift(alertLog);
    if (webhookLogs.length > 100) {
      webhookLogs = webhookLogs.slice(0, 100);
    }

    return res.status(401).json({
      success: false,
      error: "Unauthorized signature verification failed. Invalid or missing WEBHOOK_SECRET token.",
      remediation: "Include the X-API-KEY header or Authorization Bearer header matching the container's WEBHOOK_SECRET.",
    });
  }
  next();
};

// API: Get app settings or test status
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    time: new Date().toISOString(),
    appUrl: process.env.APP_URL || "http://localhost:3000",
    message: "XAUUSD bot endpoint active",
  });
});

// API: Webhook receiver from MetaTrader 5 Expert Advisor (Protected with Rate limiting and auth token check)
app.post("/api/webhook", webhookLimiter, authenticateWebhook, (req, res) => {
  const { type, message, price, direction, lots, sl, tp1, tp2, spread } = req.body;

  const newLog: WebhookLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: type || "info",
    message: message || "No message provided",
    time: new Date().toISOString(),
    price: typeof price === "number" ? price : 0,
    direction,
    lots,
    sl,
    tp1,
    tp2,
    spread: typeof spread === "number" ? spread : 0,
  };

  webhookLogs.unshift(newLog);
  // Keep last 100 entries
  if (webhookLogs.length > 100) {
    webhookLogs = webhookLogs.slice(0, 100);
  }

  console.log(`[MT5 Webhook] [${newLog.type.toUpperCase()}] at ${newLog.price}: ${newLog.message}`);

  res.status(200).json({
    success: true,
    message: "Webhook processed, active logs updated.",
    received: newLog,
  });
});

// Friendly GET handler so users opening the URL in their browser see dynamic verification diagnostic status
app.get("/api/webhook", (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol || "https";
  const activeSecret = process.env.WEBHOOK_SECRET || "XAUUSD_METABOT_SECURE_TOKEN_2026";
  
  res.json({
    status: "active",
    online: true,
    security: {
      apiLimiter: "60 request/minute IP Cap ENFORCED",
      authenticationType: "Secure WEBHOOK_SECRET validation check required on POST hits",
      headerKeysExpected: ["X-API-KEY", "Authorization: Bearer <key>"],
      activeSecretMasked: `${activeSecret.substring(0, 4)}...${activeSecret.substring(activeSecret.length - 4)}`
    },
    message: "XAUUSD MetaBot Webhook is fully open, secure, & live on the public web!",
    instructions: "To stream live positions, ensure your MQL5 script transmits either the 'X-API-KEY' header or 'Authorization' token matching your environment variable.",
    expectedMethod: "POST",
    mt5Setup: {
      step1: "Open MT5 -> Tools -> Options -> Expert Advisors",
      step2: "Check 'Allow WebRequest for listed URL'",
      step3: `Add domain: ${protocol}://${host}`
    },
    samplePayloadAndHeaders: {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": activeSecret
      },
      body: {
        type: "entry",
        message: "SMA 9 crossed above EMA 50 on 15m. Order Executed.",
        price: 2348.65,
        direction: "BUY",
        lots: [0.05, 0.05],
        sl: 2340.50,
        tp1: 2365.25,
        tp2: 2380.00,
        spread: 18
      }
    }
  });
});


// API: Retrieve latest logs for dashboard tracking
app.get("/api/webhook/logs", (req, res) => {
  res.json({
    logs: webhookLogs,
    count: webhookLogs.length,
  });
});

// API: Clear in-memory logs
app.post("/api/webhook/clear", (req, res) => {
  webhookLogs = [
    {
      id: `clear-${Date.now()}`,
      type: "info",
      message: "Notification logs cleared.",
      time: new Date().toISOString(),
      price: 0,
    }
  ];
  res.json({ success: true, logs: webhookLogs });
});

async function startServer() {
  // Vite as development middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
    console.log(`Webhook endpoint: http://0.0.0.0:${PORT}/api/webhook`);
  });
}

startServer();
