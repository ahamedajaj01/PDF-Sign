// Import required libraries
require("dotenv").config();
const express = require("express");      // Web server
const cors = require("cors");            // Allow frontend to call backend
const mongoose = require("mongoose");    // MongoDB connection
const fs = require("fs");                // Read/write files
const crypto = require("crypto");        // Create SHA-256 hashes
const { PDFDocument } = require("pdf-lib"); // Modify PDF files

// Create express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Enable CORS and JSON body parsing
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.Alloed_origin || "")
  .split(",")
  .map(o => o.trim().replace(/\/$/, ""))
  .filter(o => o !== "");

if (allowedOrigins.length === 0) {
  allowedOrigins.push("http://localhost:5173", "http://localhost:3000");
}

console.log("Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        console.log(`CORS Blocked: ${origin}. Allowed: ${allowedOrigins.join(", ")}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" })); // Allow large base64 image uploads

// Connect to MongoDB database
if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI is not defined in environment variables");
} else {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));
}

// Define audit log schema to track PDF history
const AuditLog = mongoose.model(
  "AuditLog",
  new mongoose.Schema({
    pdfId: String,            // Which PDF was signed
    originalHash: String,     // Hash before signing
    signedHash: String,       // Hash after signing
    signedAt: { type: Date, default: Date.now } // Timestamp
  })
);

// Helper function to generate SHA-256 hash
const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

// API endpoint to sign PDF
app.post("/sign-pdf", async (req, res) => {
  // Get field position and signature image from frontend
  const { field, signatureBase64 } = req.body;

  // Read original PDF file
  const pdfPath = process.env.PDF_PATH || "sample.pdf";
  if (!fs.existsSync(pdfPath)) {
    return res.status(500).json({ error: `PDF file not found at ${pdfPath}` });
  }
  const originalPdf = fs.readFileSync(pdfPath);

  // Generate hash of original PDF
  const originalHash = sha256(originalPdf);

  // Load PDF into memory
  const pdfDoc = await PDFDocument.load(originalPdf);

  // Get the page where signature should be placed
  const page = pdfDoc.getPage(field.page - 1);

  // Get page size in PDF points
  const { width, height } = page.getSize();

  // Convert percentage-based position to PDF coordinates
  const boxX = field.xPct * width;
  const boxY = height - (field.yPct + field.hPct) * height;
  const boxW = field.wPct * width;
  const boxH = field.hPct * height;

  // Convert base64 image to buffer and embed into PDF
  const img = await pdfDoc.embedPng(
    Buffer.from(signatureBase64, "base64")
  );

  // Keep image aspect ratio inside the box
  const ratio = img.width / img.height;
  const drawW = Math.min(boxW, boxH * ratio);
  const drawH = drawW / ratio;

  // Draw signature image centered inside the box
  page.drawImage(img, {
    x: boxX + (boxW - drawW) / 2,
    y: boxY + (boxH - drawH) / 2,
    width: drawW,
    height: drawH
  });

  // Save the signed PDF
  const signedPdf = await pdfDoc.save();
  fs.writeFileSync("signed.pdf", signedPdf);

  // Store audit record in MongoDB
  await AuditLog.create({
    pdfId: "sample.pdf",
    originalHash,
    signedHash: sha256(signedPdf)
  });

  // Send success response to frontend
  res.json({ success: true });
});

// Start backend server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
