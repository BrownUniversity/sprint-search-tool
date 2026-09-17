import fs from "node:fs/promises";

const iconFiles = [
  "assets/favicon.ico",
  "assets/favicon-16x16.png",
  "assets/favicon-32x32.png",
  "assets/apple-touch-icon.png",
  "assets/safari-pinned-tab.svg"
];

const requiredFiles = [
  "index.html",
  "assets/app.js",
  "assets/styles.css",
  "data/directory.json",
  ...iconFiles
];

for (const file of requiredFiles) {
  try {
    await fs.access(file);
  } catch {
    throw new Error(
      `Cannot build the site because required file "${file}" is missing.`
    );
  }
}

await fs.rm("dist", { recursive: true, force: true });
await fs.mkdir("dist/assets", { recursive: true });
await fs.mkdir("dist/data", { recursive: true });

await Promise.all([
  fs.copyFile("index.html", "dist/index.html"),
  fs.copyFile("assets/app.js", "dist/assets/app.js"),
  fs.copyFile("assets/styles.css", "dist/assets/styles.css"),
  fs.copyFile("data/directory.json", "dist/data/directory.json"),
  ...iconFiles.map(file => fs.copyFile(file, `dist/${file}`))
]);

await fs.writeFile("dist/.nojekyll", "", "utf8");

console.log("Production site created in dist/.");
