
const { getAdmissionsConfig } = require("./admissionsConfig");

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const CONFIG = getAdmissionsConfig();

const ACADEMIC_YEAR = CONFIG.academicYear;
const SOURCE_URL = CONFIG.instituteSource.url;
const EXPECTED_COUNT = CONFIG.instituteSource.expectedCount;

const OUTPUT_PATH = process.env.CLGWISE_INSTITUTES_OUTPUT
  ? path.resolve(process.env.CLGWISE_INSTITUTES_OUTPUT)
  : path.join(
      __dirname,
      "../data/admissions",
      ACADEMIC_YEAR,
      "institutes.json"
    );

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function fetchInstituteList() {
  console.log("Fetching official CET Cell institute list...");
  console.log(`Academic Year: ${ACADEMIC_YEAR}`);
  console.log(`Source: ${SOURCE_URL}`);

  const response = await axios.get(SOURCE_URL, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html",
    },
  });

  const $ = cheerio.load(response.data);
  const institutes = [];

  const table = $("table").first();

  if (!table.length) {
    throw new Error("Official institute table not found.");
  }

  const rows = table.find("tr");
  const headers = [];

  $(rows[0])
    .find("th, td")
    .each((index, cell) => {
      headers.push(
        normalizeText($(cell).text()).toLowerCase()
      );
    });

  const serialIndex = headers.findIndex(
    (value) => value.includes("sr. no")
  );

  const codeIndex = headers.findIndex(
    (value) => value.includes("institute code")
  );

  const nameIndex = headers.findIndex(
    (value) => value.includes("institute name")
  );

  if (serialIndex === -1 || codeIndex === -1 || nameIndex === -1) {
    throw new Error(
      `Unexpected table headers: ${headers.join(", ")}`
    );
  }

  rows.slice(1).each((_, row) => {
    const cells = $(row).find("td");

    const serialRaw = normalizeText(
      $(cells[serialIndex]).text()
    );

    const instituteCode = normalizeText(
      $(cells[codeIndex]).text()
    );

    const instituteName = normalizeText(
      $(cells[nameIndex]).text()
    );

    // Official page uses serial numbers like "1.", "2.", etc.
    const serialNumber = Number(serialRaw.replace(/\.$/, ""));

    if (
      !Number.isInteger(serialNumber) ||
      !/^\d{5}$/.test(instituteCode) ||
      !instituteName
    ) {
      return;
    }

    institutes.push({
      serialNumber,
      instituteCode,
      instituteName,
    });
  });

  const uniqueCodes = new Set(
    institutes.map((item) => item.instituteCode)
  );

  const duplicateCount = institutes.length - uniqueCodes.size;

  const dataset = {
    metadata: {
      academicYear: ACADEMIC_YEAR,
      source: CONFIG.instituteSource.name,
      sourceUrl: SOURCE_URL,
      extractedAt: new Date().toISOString(),
      totalInstitutes: institutes.length,
      expectedInstitutes: EXPECTED_COUNT,
      uniqueInstituteCodes: uniqueCodes.size,
      duplicateCodes: duplicateCount,
      status:
        institutes.length === EXPECTED_COUNT &&
        duplicateCount === 0
          ? "verified"
          : "needs_review",
    },
    institutes,
  };

  if (duplicateCount > 0) {
    throw new Error(
      `Found ${duplicateCount} duplicate institute codes.`
    );
  }

  if (institutes.length !== EXPECTED_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_COUNT} institutes but extracted ${institutes.length}. Dataset not marked verified.`
    );
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), {
    recursive: true,
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(dataset, null, 2),
    "utf-8"
  );

  console.log("\nInstitute extraction completed.");
  console.log("--------------------------------");
  console.log(`Academic Year: ${ACADEMIC_YEAR}`);
  console.log(`Institutes: ${institutes.length}`);
  console.log(`Unique codes: ${uniqueCodes.size}`);
  console.log(`Duplicate codes: ${duplicateCount}`);
  console.log(`Status: ${dataset.metadata.status}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

fetchInstituteList().catch((error) => {
  console.error("\nInstitute extraction failed:");
  console.error(error.message);
  process.exitCode = 1;
});
