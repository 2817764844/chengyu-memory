const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const www = path.join(root, "www");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "storage.js",
  "dictionary.js",
  "similar-matcher.js",
  "chengyu-bank.js",
  "chengyu-similar.js",
  "chengyu-clusters-map.js",
  "cloud-config.js",
  "chengyu-sync.js",
  "account.js",
  "update-check.js",
  "update.js",
];

fs.mkdirSync(www, { recursive: true });
for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(www, name));
}

console.log(`Copied ${files.length} files to www/`);