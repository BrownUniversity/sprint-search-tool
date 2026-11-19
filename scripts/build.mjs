import fs from "node:fs/promises";

const iconFiles = [
  "assets/favicon.ico",
  "assets/favicon-16x16.png",
  "assets/favicon-32x32.png",
  "assets/apple-touch-icon.png",
  "assets/safari-pinned-tab.svg"
];

const siteFiles = [
  "index.html",
  "assets/app.js",
  "assets/styles.css",
  ...iconFiles
];

const STAGING_DATA = "data/staging/directory.json";
const STAGING_REPORT = "data/staging/publication-report.md";

const STAGING_BANNER = `<div class="staging-banner" role="note">
    <strong>Staging preview.</strong>
    This page shows the Staging tab, not the live directory.
    <a href="../">View the live site</a>
  </div>`;

const NOINDEX = `<meta name="robots" content="noindex, nofollow">`;

for (const file of [...siteFiles, "data/directory.json"]) {
  try {
    await fs.access(file);
  } catch {
    throw new Error(
      `Cannot build the site because required file "${file}" is missing.`
    );
  }
}

await fs.rm("dist", { recursive: true, force: true });
await buildSite("dist", "data/directory.json");
await fs.writeFile("dist/.nojekyll", "", "utf8");
await fs.writeFile(
  "dist/robots.txt",
  "User-agent: *\nDisallow: /staging/\n",
  "utf8"
);

console.log("Production site created in dist/.");

// Staging is built only after `npm run import:staging`. When that import
// failed, the staging page lists its errors instead of a stale preview.
if (await exists(STAGING_DATA)) {
  await buildSite("dist/staging", STAGING_DATA, { staging: true });
  console.log("Staging preview created in dist/staging/.");
} else if (await exists(STAGING_REPORT)) {
  await buildStagingErrorPage(STAGING_REPORT);
  console.log("Staging import failed; dist/staging/ lists its errors.");
}

async function buildSite(outDir, dataFile, { staging = false } = {}) {
  await fs.mkdir(`${outDir}/assets`, { recursive: true });
  await fs.mkdir(`${outDir}/data`, { recursive: true });

  let html = await fs.readFile("index.html", "utf8");

  if (staging) {
    html = insertOnce(html, "</head>", `  ${NOINDEX}\n</head>`);
    html = insertOnce(html, "<body>", `<body>\n  ${STAGING_BANNER}`);
  }

  await Promise.all([
    fs.writeFile(`${outDir}/index.html`, html, "utf8"),
    ...siteFiles
      .filter(file => file !== "index.html")
      .map(file => fs.copyFile(file, `${outDir}/${file}`)),
    fs.copyFile(dataFile, `${outDir}/data/directory.json`)
  ]);
}

async function buildStagingErrorPage(reportFile) {
  const report = await fs.readFile(reportFile, "utf8");

  await fs.mkdir("dist/staging", { recursive: true });
  await fs.writeFile(
    "dist/staging/index.html",
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${NOINDEX}
  <title>Staging preview unavailable | SPRINT</title>
  <link rel="icon" href="../assets/favicon.ico" sizes="32x32 48x48">
  <link rel="stylesheet" href="../assets/styles.css">
</head>
<body>
  ${STAGING_BANNER}
  <main class="staging-errors">
    <h1>The staging preview could not be built</h1>
    <p>
      Fix the issues below in the Staging tab. The live site is not affected.
      This page updates on the next publish, within about ten minutes.
    </p>
${reportToHtml(report)}
  </main>
</body>
</html>
`,
    "utf8"
  );
}

// Renders the publication report's small Markdown subset: "## " headings,
// "- " list items, plain paragraphs, and **bold**. Its "# " title is dropped
// because the page supplies its own heading.
function reportToHtml(markdown) {
  const html = [];
  let inList = false;

  for (const line of markdown.split("\n")) {
    const isItem = line.startsWith("- ");

    if (inList && !isItem) {
      html.push("    </ul>");
      inList = false;
    }

    if (isItem) {
      if (!inList) {
        html.push("    <ul>");
        inList = true;
      }

      html.push(`      <li>${inline(line.slice(2))}</li>`);
    } else if (line.startsWith("## ")) {
      html.push(`    <h2>${inline(line.slice(3))}</h2>`);
    } else if (line.trim() && !line.startsWith("# ")) {
      html.push(`    <p>${inline(line)}</p>`);
    }
  }

  if (inList) {
    html.push("    </ul>");
  }

  return html.join("\n");
}

function inline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function insertOnce(html, marker, replacement) {
  if (html.split(marker).length !== 2) {
    throw new Error(
      `Cannot mark the staging page: index.html must contain "${marker}" once.`
    );
  }

  return html.replace(marker, replacement);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
