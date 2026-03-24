const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const QUOTIENT_URL = process.env.QUOTIENT_URL || "http://localhost:8080";
const QUOTIENT_TOKEN = process.env.QUOTIENT_TOKEN || "";
const QUOTIENT_PUBLIC_URL = process.env.QUOTIENT_PUBLIC_URL || QUOTIENT_URL;

app.use(express.json());

app.get("/api/config", (req, res) => {
  res.json({ quotientPublicUrl: QUOTIENT_PUBLIC_URL });
});

// Proxy Quotient API requests to keep the token server-side
app.get("/api/quotient/{*path}", async (req, res) => {
  const quotientPath = Array.isArray(req.params.path)
    ? req.params.path.join("/")
    : req.params.path;
  const url = `${QUOTIENT_URL}/api/${quotientPath}`;

  const headers = {};
  if (QUOTIENT_TOKEN) {
    headers["Cookie"] = `quotient=${QUOTIENT_TOKEN}`;
  }

  try {
    console.log(`Proxying: ${url}`);
    const response = await fetch(url, { headers });
    console.log(`Quotient responded: ${response.status} ${response.statusText}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error(`Quotient proxy error:`, err);
    res.status(502).json({ error: "Failed to reach Quotient" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Info display running at http://localhost:${PORT}`);
  console.log(`Quotient URL: ${QUOTIENT_URL}`);
  console.log(`Quotient auth: ${QUOTIENT_TOKEN ? "enabled" : "disabled"}`);
});
