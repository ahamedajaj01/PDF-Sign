import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import config from "./config/config"

// Tell react-pdf where the PDF.js worker is
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

export default function App() {
  // Store rendered PDF page size (changes based on screen size)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // Store uploaded signature image as base64
  const [signatureBase64, setSignatureBase64] = useState(null);

  // Signature field stored in PERCENTAGES, not pixels
  // This is what makes the placement responsive
  const [field, setField] = useState({
    page: 1,
    xPct: 0.25, // 25% from left of PDF
    yPct: 0.25, // 25% from top of PDF
    wPct: 0.3,  // 30% of PDF width
    hPct: 0.08, // 8% of PDF height
  });

  // Handle dragging of the signature box
  const handleMouseDown = (e) => {
    e.preventDefault();

    // Do nothing until PDF size is known
    if (!pageSize.width) return;

    const startX = e.clientX;
    const startY = e.clientY;

    // Save starting percentages
    const startXPct = field.xPct;
    const startYPct = field.yPct;

    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      // Convert pixel movement into percentage movement
      setField((prev) => ({
        ...prev,
        xPct: Math.min(
          Math.max(startXPct + dx / pageSize.width, 0),
          1 - prev.wPct
        ),
        yPct: Math.min(
          Math.max(startYPct + dy / pageSize.height, 0),
          1 - prev.hPct
        ),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Send signature + field data to backend to burn into PDF
  const handleSign = async () => {
    await fetch(`${config.baseUrl}/sign-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, signatureBase64 }),
    });

    alert("PDF signed");
  };

  return (
    // Responsive layout:
    // Desktop → PDF and controls side by side
    // Mobile → stacked vertically
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        padding: 20,
        justifyContent: "center",
      }}
    >
      {/* PDF container */}
      <div style={{ position: "relative", maxWidth: "100%" }}>
        <Document file="/sample.pdf">
          <Page
            pageNumber={1}
            // Capture rendered PDF size
            // This changes automatically when screen size changes
            onRenderSuccess={(p) =>
              setPageSize({ width: p.width, height: p.height })
            }
          />
        </Document>

        {/* Signature overlay */}
        {pageSize.width > 0 && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: "absolute",

              // Convert percentages back to pixels
              // This keeps the box anchored on resize
              top: field.yPct * pageSize.height,
              left: field.xPct * pageSize.width,
              width: field.wPct * pageSize.width,
              height: field.hPct * pageSize.height,

              border: "2px dashed blue",
              background: "rgba(0,0,255,0.05)",
              cursor: "move",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            {/* Show preview image after upload */}
            {signatureBase64 ? (
              <img
                src={`data:image/png;base64,${signatureBase64}`}
                alt="Signature preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                }}
              />
            ) : (
              "Signature"
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {/* Controls anchored to the PDF */}
<div
  style={{
    position: "absolute",
    top: 10,
    right: 10,
    display: "flex",
    gap: 8,
    background: "white",
    padding: 6,
    borderRadius: 4,
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  }}
>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const reader = new FileReader();
      reader.onload = () =>
        setSignatureBase64(reader.result.split(",")[1]);
      reader.readAsDataURL(e.target.files[0]);
    }}
  />

  <button onClick={handleSign} disabled={!signatureBase64}>
    Sign PDF
  </button>
</div>


    </div>
  );
}
