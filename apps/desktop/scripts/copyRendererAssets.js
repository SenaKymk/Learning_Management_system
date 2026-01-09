const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const source = path.join(rootDir, "renderer", "index.html");
const targetDir = path.join(rootDir, "dist", "renderer");
const target = path.join(targetDir, "index.html");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
