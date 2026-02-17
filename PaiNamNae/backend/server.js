require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const promClient = require("prom-client");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./src/config/swagger");
const routes = require("./src/routes");
const { errorHandler } = require("./src/middlewares/errorHandler");
const { metricsMiddleware } = require("./src/middlewares/metrics");
const { protect } = require("./src/middlewares/auth"); // ✅ FIXED
const ApiError = require("./src/utils/ApiError");
const ensureAdmin = require("./src/bootstrap/ensureAdmin");
const prisma = require("./src/utils/prisma");

const app = express();
const httpServer = http.createServer(app);

/* ------------------ METRICS ------------------ */
promClient.collectDefaultMetrics();

/* ------------------ SECURITY ------------------ */
app.use(helmet());

const corsOptions = {
  origin: [
    "http://localhost:3001",
    "https://amazing-crisp-9bcb1a.netlify.app",
    "http://painamnae05.cpkku.com",
    "https://painamnae05.cpkku.com",
  ],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(metricsMiddleware);

/* ------------------ AUTH ROUTE ------------------ */
// 🔥 ใช้ sub เพราะ middleware ของคุณเก็บ sub
app.get("/api/me", protect, (req, res) => {
  res.json({
    id: req.user.sub,
    role: req.user.role,
  });
});

/* ------------------ SOCKET.IO ------------------ */
const io = new Server(httpServer, { cors: corsOptions });
app.set("io", io);

io.on("connection", (socket) => {
  console.log("📡 CONNECTED:", socket.id);

  socket.on("join_room", (roomId) => {
    if (!roomId) return;
    console.log("🏠 JOIN ROOM:", socket.id, roomId);
    socket.join(String(roomId));
  });

  socket.on("send_message", (data) => {
    if (!data?.room) return;

    console.log("📨 SEND:", socket.id, data.room);

    io.to(String(data.room)).emit("receive_message", {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ DISCONNECTED:", socket.id, reason);
  });
});

/* ------------------ HEALTH ------------------ */
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "error", detail: err.message });
  }
});

/* ------------------ METRICS ------------------ */
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

/* ------------------ SWAGGER ------------------ */
app.use("/documentation", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ------------------ API ROUTES ------------------ */
app.use("/api", routes);

/* ------------------ 404 ------------------ */
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

/* ------------------ ERROR HANDLER ------------------ */
app.use(errorHandler);

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureAdmin();
  } catch (err) {
    console.error("Admin bootstrap failed:", err);
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})();

/* ------------------ GLOBAL ERROR ------------------ */
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥", err);
  process.exit(1);
});
