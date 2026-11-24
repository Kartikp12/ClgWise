
const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SOURCES = require("./sources.cjs");

const STATE_DIRECTORY = path.join(
  process.cwd(),
  "lib",
  "data",
  "monitoring"
);

const STATE_PATH = path.join(
  STATE_DIRECTORY,
  "source-monitor-state.json"
);

function readState() {
  if (!fs.existsSync(STATE_PATH)) {
    return {
      schemaVersion: 1,
      lastRunAt: null,
      sources: {},
    };
  }

  const state = JSON.parse(
    fs.readFileSync(STATE_PATH, "utf8")
  );

  if (
    state.schemaVersion !== 1 ||
    !state.sources ||
    typeof state.sources !== "object"
  ) {
    throw new Error(
      "Invalid source monitoring state file."
    );
  }

  return state;
}

function extractPageContent(html, sourceUrl) {
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, svg").remove();

  const title = $("title")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const headings = $("h1, h2, h3")
    .map((_, element) =>
      $(element).text().replace(/\s+/g, " ").trim()
    )
    .get()
    .filter(Boolean);

  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const links = $("a[href]")
    .map((_, element) => {
      const text = $(element)
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const href = $(element).attr("href");

      try {
        return `${text} | ${new URL(href, sourceUrl).href}`;
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);

  if (bodyText.length < 100) {
    throw new Error(
      "HTML content is unexpectedly short. " +
      "The page may require JavaScript rendering or may be blocked."
    );
  }

  return [
    title,
    ...headings,
    bodyText,
    ...links,
  ].join("\n");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(value[key])}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function extractJsonContent(data) {
  let parsedData = data;

  if (typeof parsedData === "string") {
    try {
      parsedData = JSON.parse(parsedData);
    } catch {
      throw new Error(
        "Expected JSON from FRA API, but received non-JSON content. " +
        "Check the API URL or authentication requirements."
      );
    }
  }

  if (
    parsedData === null ||
    parsedData === undefined ||
    typeof parsedData !== "object"
  ) {
    throw new Error(
      "API returned an invalid JSON response."
    );
  }

  const content = stableStringify(parsedData);

  if (!content || content.length < 2) {
    throw new Error(
      "API returned empty JSON content."
    );
  }

  return content;
}

function extractSourceContent(response, source) {
  const contentType =
    response.headers["content-type"] || "";

  if (
    source.format === "json" ||
    contentType.includes("application/json")
  ) {
    return extractJsonContent(response.data);
  }

  return extractPageContent(
    response.data,
    source.url
  );
}

function createHash(content) {
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");
  }

async function checkSource(source, previousState) {
  const checkedAt = new Date().toISOString();

  // Never reuse old ETag/hash when a source URL changes.
  const compatiblePreviousState =
    previousState?.url === source.url
      ? previousState
      : null;

  const headers = {
    "User-Agent": "ClgWise-Official-Source-Monitor/1.0",
    Accept:
      source.format === "json"
        ? "application/json"
        : "text/html,application/xhtml+xml",
  };

  if (compatiblePreviousState?.etag) {
    headers["If-None-Match"] =
      compatiblePreviousState.etag;
  }

  if (compatiblePreviousState?.lastModified) {
    headers["If-Modified-Since"] =
      compatiblePreviousState.lastModified;
  }

  let httpStatus = null;

  try {
    const response = await axios.get(source.url, {
      timeout: 30000,
      maxRedirects: 5,
      responseType:
  source.format === "pdf"
    ? "arraybuffer"
    : "text",
      headers,
      validateStatus: (status) =>
        (status >= 200 && status < 300) ||
        status === 304,
    });

    httpStatus = response.status;

    if (response.status === 304) {
      if (!compatiblePreviousState?.contentHash) {
        throw new Error(
          "Server returned 304 without an existing baseline."
        );
      }

      return {
        ...compatiblePreviousState,
        sourceId: source.id,
        authority: source.authority,
        category: source.category,
        academicYearScope: source.academicYearScope,
        url: source.url,
        lastCheckedAt: checkedAt,
        lastSuccessfulCheckAt: checkedAt,
        lastHttpStatus: 304,
        lastStatus: "not_modified",
        consecutiveFailures: 0,
        lastError: null,
      };
    }

    const content =
    source.format === "pdf"
      ? Buffer.from(response.data)
      : extractSourceContent(response, source);
  
  if (!content || content.length === 0) {
    throw new Error("Official source returned empty content.");
  }
  
  const currentHash = createHash(content);
    const previousHash =
      compatiblePreviousState?.contentHash;

    let status = "unchanged";

    let lastChangedAt =
      compatiblePreviousState?.lastChangedAt || null;

    let changeCount =
      compatiblePreviousState?.changeCount || 0;

    if (!previousHash) {
      status = "baseline_created";
      lastChangedAt = checkedAt;
    } else if (previousHash !== currentHash) {
      status = "changed";
      lastChangedAt = checkedAt;
      changeCount += 1;
    }

    return {
      sourceId: source.id,
      authority: source.authority,
      category: source.category,
      academicYearScope: source.academicYearScope,
      url: source.url,

      contentHash: currentHash,

      etag: response.headers.etag || null,
      lastModified:
        response.headers["last-modified"] || null,

      lastCheckedAt: checkedAt,
      lastSuccessfulCheckAt: checkedAt,
      lastChangedAt,

      lastHttpStatus: response.status,
      lastStatus: status,

      changeCount,
      consecutiveFailures: 0,
      lastError: null,
    };
  } catch (error) {
    return {
      ...(compatiblePreviousState || {}),

      sourceId: source.id,
      authority: source.authority,
      category: source.category,
      academicYearScope: source.academicYearScope,
      url: source.url,

      lastCheckedAt: checkedAt,
      lastHttpStatus: httpStatus,
      lastStatus: "error",

      consecutiveFailures:
        (compatiblePreviousState?.consecutiveFailures || 0) + 1,

      lastError: error.response?.status
        ? `HTTP ${error.response.status}: ${error.message}`
        : error.message,
    };
  }
}

function saveState(state) {
  fs.mkdirSync(STATE_DIRECTORY, {
    recursive: true,
  });

  const temporaryPath = `${STATE_PATH}.tmp`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(state, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryPath, STATE_PATH);
}

async function monitorSources() {
  console.log("\n======================================");
  console.log("       CLGWISE SOURCE MONITOR");
  console.log("======================================\n");

  const state = readState();

  const enabledSources = SOURCES.filter(
    (source) => source.enabled
  );

  const results = [];

  for (const source of enabledSources) {
    console.log(`Checking: ${source.authority}`);
    console.log(`Source: ${source.url}`);

    const previousState = state.sources[source.id];

    const result = await checkSource(
      source,
      previousState
    );

    state.sources[source.id] = result;
    results.push(result);

    console.log(`Status: ${result.lastStatus}`);

    if (result.lastError) {
      console.log(`Error: ${result.lastError}`);
    }

    console.log("--------------------------------------");
  }

  state.lastRunAt = new Date().toISOString();

  saveState(state);

  const changed = results.filter(
    (item) => item.lastStatus === "changed"
  );

  const baseline = results.filter(
    (item) => item.lastStatus === "baseline_created"
  );

  const failed = results.filter(
    (item) => item.lastStatus === "error"
  );

  const successful = results.length - failed.length;

  console.log("\n========== MONITORING SUMMARY ==========");
  console.log(`Sources checked: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`New baselines: ${baseline.length}`);
  console.log(`Changes detected: ${changed.length}`);
  console.log(`Failed sources: ${failed.length}`);
  console.log(`State file: ${STATE_PATH}`);

  if (changed.length > 0) {
    console.log("\nCHANGED SOURCES:");

    changed.forEach((item) => {
      console.log(`- ${item.sourceId}: ${item.url}`);
    });
  }

  if (failed.length > 0) {
    console.log("\nFAILED SOURCES:");

    failed.forEach((item) => {
      console.log(`- ${item.sourceId}: ${item.lastError}`);
    });
  }

  console.log("\nMonitoring completed.\n");

  if (failed.length === results.length) {
    throw new Error(
      "All official sources failed. Monitoring could not verify any source."
    );
  }
}

monitorSources().catch((error) => {
  console.error("\nSource monitoring failed:");
  console.error(error.message);

  process.exitCode = 1;
});
