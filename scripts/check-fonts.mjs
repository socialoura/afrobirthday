import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

// Builds must not depend on Google's CSS response shape or availability.
function checkSources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkSources(file);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      assert.ok(!readFileSync(file, "utf8").includes("next/font/google"),
        `${path.relative(root, file)} still downloads fonts during the build`);
    }
  }
}
checkSources(path.join(root, "src"));

const document = readFileSync(path.join(root, "src/components/RootDocument.tsx"), "utf8");
assert.ok(document.includes('from "next/font/local"'), "Use Next's local font loader");
for (const [file, family, variable] of [
  ["dm-sans-variable.ttf", "DM Sans", "--font-body"],
  ["space-grotesk-variable.ttf", "Space Grotesk", "--font-display"],
]) {
  assert.ok(document.includes(`./fonts/${file}`), `${family} must be loaded locally`);
  assert.ok(document.includes(variable), `Preserve ${variable}`);
  const bytes = readFileSync(path.join(root, "src/components/fonts", file));
  assert.equal(bytes.readUInt32BE(0), 0x00010000, `${family} must be a real TrueType font`);
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const offset = 12 + i * 16;
    tables.set(bytes.toString("ascii", offset, offset + 4), bytes.readUInt32BE(offset + 8));
  }
  assert.ok(tables.has("fvar"), `${family} must support variable weights`);
  const fvar = tables.get("fvar");
  const axesOffset = bytes.readUInt16BE(fvar + 4);
  const axisCount = bytes.readUInt16BE(fvar + 8);
  const axisSize = bytes.readUInt16BE(fvar + 10);
  let weights;
  for (let i = 0; i < axisCount; i++) {
    const axis = fvar + axesOffset + i * axisSize;
    if (bytes.toString("ascii", axis, axis + 4) === "wght") {
      weights = [bytes.readInt32BE(axis + 4) / 65536, bytes.readInt32BE(axis + 12) / 65536];
    }
  }
  assert.ok(weights && weights[0] <= 400 && weights[1] >= 700,
    `${family} must retain all storefront weights (400–700)`);
}
console.log("PASS: local variable fonts; weights 400–700; no Google Fonts build dependency.");
