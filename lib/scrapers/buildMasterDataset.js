
const fs = require("fs");
const path = require("path");

const ACADEMIC_YEAR = "2026-27";
const ROUND_NAME = "CAP Round 1";

const DATA_DIR = path.join(
  __dirname,
  "../data/admissions",
  ACADEMIC_YEAR
);

const INSTITUTES_PATH = path.join(DATA_DIR, "institutes.json");
const CUTOFF_PATH = path.join(DATA_DIR, "cap-round-1.json");
const OUTPUT_PATH = path.join(DATA_DIR, "master-colleges.json");

const OFFICIAL_CUTOFF_URL =
  "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function normalizeCode(value) {
  return String(value ?? "").trim().padStart(5, "0");
}

function validateUniqueCodes(items, getCode, label) {
  const seen = new Set();
  const duplicates = [];

  for (const item of items) {
    const code = normalizeCode(getCode(item));

    if (!/^\d{5}$/.test(code)) {
      throw new Error(`${label}: Invalid institute code "${code}".`);
    }

    if (seen.has(code)) {
      duplicates.push(code);
    }

    seen.add(code);
  }

  if (duplicates.length) {
    throw new Error(
      `${label}: Duplicate institute codes found: ${duplicates.join(", ")}`
    );
  }

  return seen;
}

function buildMasterDataset() {
  console.log("Building ClgWise Unified Master Dataset...");
  console.log("------------------------------------------");

  const instituteDataset = readJson(INSTITUTES_PATH);
  const cutoffDataset = readJson(CUTOFF_PATH);

  const institutes = instituteDataset.institutes;
  const cutoffColleges = cutoffDataset.colleges;

  if (!Array.isArray(institutes) || !Array.isArray(cutoffColleges)) {
    throw new Error("Invalid input JSON structure.");
  }

  if (
    instituteDataset.metadata?.academicYear !== ACADEMIC_YEAR ||
    cutoffDataset.metadata?.academicYear !== ACADEMIC_YEAR
  ) {
    throw new Error("Academic year mismatch between input datasets.");
  }

  if (instituteDataset.metadata?.status !== "verified") {
    throw new Error(
      "Institute dataset is not verified. Master dataset was not generated."
    );
  }

  const expectedCount = instituteDataset.metadata.expectedInstitutes;

  if (
    Number.isInteger(expectedCount) &&
    institutes.length !== expectedCount
  ) {
    throw new Error(
      `Expected ${expectedCount} institutes, found ${institutes.length}.`
    );
  }

  const instituteCodes = validateUniqueCodes(
    institutes,
    (item) => item.instituteCode,
    "Institute dataset"
  );

  validateUniqueCodes(
    cutoffColleges,
    (item) => item.collegeCode,
    "Cutoff dataset"
  );

  const cutoffMap = new Map();

  for (const college of cutoffColleges) {
    const code = normalizeCode(college.collegeCode);

    if (!Array.isArray(college.courses)) {
      throw new Error(
        `Invalid courses structure for cutoff college ${code}.`
      );
    }

    cutoffMap.set(code, college);
  }

  // Every cutoff college must exist in the official institute list.
  const unmatchedCutoffColleges = [...cutoffMap.keys()].filter(
    (code) => !instituteCodes.has(code)
  );

  if (unmatchedCutoffColleges.length > 0) {
    throw new Error(
      `Cutoff colleges missing from official institute list: ${unmatchedCutoffColleges.join(", ")}`
    );
  }

  const cutoffSource = {
    name: cutoffDataset.metadata?.source || "Maharashtra State CET Cell",
    sourceUrl:
      cutoffDataset.metadata?.sourceUrl || OFFICIAL_CUTOFF_URL,
    academicYear: ACADEMIC_YEAR,
    round: ROUND_NAME,
    extractedAt: cutoffDataset.metadata?.extractedAt || null,
  };

  let institutesWithCutoff = 0;
  let institutesWithoutCutoff = 0;
  let totalCourses = 0;
  let totalCutoffRecords = 0;

  const masterInstitutes = institutes.map((institute) => {
    const code = normalizeCode(institute.instituteCode);
    const cutoffCollege = cutoffMap.get(code);

    const courses = cutoffCollege ? cutoffCollege.courses : [];

    if (cutoffCollege) {
      institutesWithCutoff += 1;
    } else {
      institutesWithoutCutoff += 1;
    }

    for (const course of courses) {
      if (!Array.isArray(course.cutoffRecords)) {
        throw new Error(
          `Invalid cutoffRecords for institute ${code}, course ${course.courseCode || "unknown"}.`
        );
      }

      totalCutoffRecords += course.cutoffRecords.length;
    }

    totalCourses += courses.length;

    return {
      instituteCode: code,
      instituteName: institute.instituteName,
      serialNumber: institute.serialNumber,

      cutoffAvailable: Boolean(cutoffCollege),

      cutoffRound: cutoffCollege ? ROUND_NAME : null,
      cutoffSource: cutoffCollege ? cutoffSource : null,

      courses,
    };
  });

  const parsingReport = cutoffDataset.parsingReport || {};

  const parsingErrors = Array.isArray(parsingReport.parsingErrors)
  ? parsingReport.parsingErrors.length
  : typeof parsingReport.parsingErrors === "number"
    ? parsingReport.parsingErrors
    : null;

  const masterDataset = {
    metadata: {
      datasetName: "ClgWise Maharashtra Engineering College Master Dataset",
      academicYear: ACADEMIC_YEAR,
      generatedAt: new Date().toISOString(),

      sources: {
        instituteList: {
          name: instituteDataset.metadata.source,
          sourceUrl: instituteDataset.metadata.sourceUrl,
          extractedAt: instituteDataset.metadata.extractedAt,
        },
        cutoff: cutoffSource,
      },

      coverage: {
        totalOfficialInstitutes: masterInstitutes.length,
        institutesWithCutoff,
        institutesWithoutCutoff,
        totalCourses,
        totalCutoffRecords,
        unmatchedCutoffColleges: unmatchedCutoffColleges.length,
      },

      dataQuality: {
        instituteListStatus: instituteDataset.metadata.status,
        cutoffParsingStatus: parsingReport.status || "not_available",
        cutoffParsingErrors: parsingErrors,
        note:
          "Missing cutoff data means no record was extracted from this CAP round dataset. It does not mean the institute has no admission seats.",
      },

      status:
        parsingReport.status === "needs_review"
          ? "verified_with_known_parsing_gaps"
          : "verified",
    },

    institutes: masterInstitutes,
  };

  // Final integrity checks before writing.
  if (
    masterDataset.institutes.length !== institutes.length ||
    institutesWithCutoff + institutesWithoutCutoff !== institutes.length
  ) {
    throw new Error("Final master dataset integrity check failed.");
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(masterDataset, null, 2),
    "utf-8"
  );

  console.log("\nMaster dataset generated successfully.");
  console.log("------------------------------------------");
  console.log(`Official institutes: ${masterInstitutes.length}`);
  console.log(`Institutes with cutoff: ${institutesWithCutoff}`);
  console.log(`Institutes without cutoff: ${institutesWithoutCutoff}`);
  console.log(`Total courses: ${totalCourses}`);
  console.log(`Total cutoff records: ${totalCutoffRecords}`);
  console.log(`Unmatched cutoff colleges: ${unmatchedCutoffColleges.length}`);
  console.log(`Parsing errors in source: ${parsingErrors ?? "Not reported"}`);
  console.log(`Dataset status: ${masterDataset.metadata.status}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

try {
  buildMasterDataset();
} catch (error) {
  console.error("\nMaster dataset generation failed:");
  console.error(error.message);
  process.exitCode = 1;
}
