require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");

const app = express();

// Clean CORS setup
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const AuditLog = mongoose.model("AuditLog", new mongoose.Schema({
  pdfId: String,
  originalHash: String,
  signedHash: String,
  signedAt: { type: Date, default: Date.now }
}));

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

app.post("/sign-pdf", async (req, res) => {
  try {
    const { field, signatureBase64 } = req.body;
    const pdfPath = process.env.PDF_PATH || "sample.pdf";

    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF not found" });

    const originalPdf = fs.readFileSync(pdfPath);
    const originalHash = sha256(originalPdf);
    const pdfDoc = await PDFDocument.load(originalPdf);
    const page = pdfDoc.getPage(field.page - 1);
    const { width, height } = page.getSize();

    const boxX = field.xPct * width;
    const boxY = height - (field.yPct + field.hPct) * height;
    const boxW = field.wPct * width;
    const boxH = field.hPct * height;

    const img = await pdfDoc.embedPng(Buffer.from(signatureBase64, "base64"));
    const ratio = img.width / img.height;
    const drawW = Math.min(boxW, boxH * ratio);
    const drawH = drawW / ratio;

    page.drawImage(img, {
      x: boxX + (boxW - drawW) / 2,
      y: boxY + (boxH - drawH) / 2,
      width: drawW,
      height: drawH
    });

    const signedPdf = await pdfDoc.save();
    fs.writeFileSync("signed.pdf", signedPdf);

    await AuditLog.create({
      pdfId: "sample.pdf",
      originalHash,
      signedHash: sha256(signedPdf)
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
