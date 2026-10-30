const express = require("express");
const path = require("path");
const { createStore } = require("./src/store");
const { createRouter } = require("./src/contacts");

const PORT = process.env.PORT || 3002;

async function main() {
  const store = await createStore();
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/health", (req, res) => {
    res.json({ status: "ok", store: store.kind });
  });

  app.get("/openapi.yaml", (req, res) => {
    res.type("text/yaml").sendFile(path.join(__dirname, "openapi.yaml"));
  });

  app.use("/v1", createRouter(store));

  app.use((req, res) => {
    res.status(404).json({ error: "Unknown endpoint: " + req.method + " " + req.path });
  });

  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  const server = app.listen(PORT, () => {
    console.log("Lab 5 API listening on http://localhost:" + PORT + " (store: " + store.kind + ")");
  });

  const shutdown = async () => {
    server.close();
    await store.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
