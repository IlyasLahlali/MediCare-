const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads", "pharmacies");

function savePharmacyImageFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;

  const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i);
  if (!match) return null;

  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (maximum 5 Mo)");
  }

  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `pharma-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/pharmacies/${filename}`;
}

module.exports = { savePharmacyImageFromDataUrl };
