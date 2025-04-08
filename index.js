const express = require("express");
const path = require("path");
const app = express();
const MainRouter = require("./Routers/Main");
const cors = require("cors");


const PORT = process.env.PORT || 30032;

app.use(cors());
app.use(express.json());

app.use("/", MainRouter);

if (process.env.NODE_ENV === "production") {
  app.use(express.static("prod"));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "prod", "index.html"));
  });
}
if (process.env.NODE_ENV !== "production") {
  app.use(express.static("dev"));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dev", "index.html"));
  });
}

app.listen(PORT);
