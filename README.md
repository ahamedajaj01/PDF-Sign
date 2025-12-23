PDF Signature Injection Prototype
Overview

This project is a prototype that allows a user to place a signature field on a PDF, preview their signature, and permanently embed (burn) the signature into the PDF while ensuring the placement remains correct across different screen sizes and devices.

The main focus of this assignment is reliable coordinate handling between browser rendering and PDF documents.

Key Problem Solved

Web browsers and PDFs use different coordinate systems:

Browser: pixels, top-left origin, responsive layout

PDF: points (72 DPI), bottom-left origin, fixed layout

To solve this, the system stores all field positions as percentages relative to the PDF page, not screen pi

How It Works
Frontend (React + react-pdf)

Renders a sample A4 PDF

Displays a draggable signature field on top of the PDF

Field position and size are stored as percentages (xPct, yPct, wPct, hPct)

When the screen size changes (desktop → mobile), the PDF re-renders and the field stays anchored correctly

User uploads a signature image and sees a preview inside the field

Clicking Sign PDF sends the placement data and image to the backend

Backend (Node.js + pdf-lib)

Receives the PD

Coordinate Calculation (Core Logic)
Frontend (Browser → Percentages)

Mouse movement is measured in pixels

Pixel movement is divided by rendered PDF width/height

Resulting values are stored as percentages

Backend (Percentages → PDF Points)

Percentages are multiplied by PDF page size

Y-axis is flipped to match PDF coordinate system

This ensures placement is device-independent and reliable.

Audit Trail (Security)

To provide document integrity verification:

SHA-256 hash is calculated before signing

SHA-256 hash is calculated after signing

Both hashes are stored in MongoDB with a timestamp

This creates a simple audit trail that can detect tampering.

Tech Stack

Frontend

React

react-pdf / PDF.js

Backend

Node.js

Express

pdf-lib

MongoDB (Mongoose)