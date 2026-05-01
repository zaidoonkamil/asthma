const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Op } = require("sequelize");
const sequelize = require("./config/db");

const usersRouter = require("./routes/user");
const adsRouter = require("./routes/ads");


sequelize
  .sync({ alter: true })
  .then(async () => {
    console.log("Database & tables synced!");
  })
  .catch((err) => {
    console.error("Error syncing database:", err);
  });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use("/uploads", express.static("./uploads"));

app.use("/", usersRouter);
app.use("/", adsRouter);



server.listen(1007, () => {
  console.log("Server running on http://localhost:1007");
});
