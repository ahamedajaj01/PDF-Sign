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

// Enable CORS and JSON body parsing
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS.split(","), // convert string → array
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "10mb" })); // Allow large base64 image uploads

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB connected"));

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
const originalPdf = fs.readFileSync(process.env.PDF_PATH);

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
app.listen(process.env.PORT, () =>
  console.log("Server running on http://localhost:3001")
);
