
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { getAdmissionsConfig } = require("./admissionsConfig");
const {
  createVersionSnapshot,
  activateVersion,
} = require("./versionedAdmissionsStore");

const CONFIG = getAdmissionsConfig();

const ACADEMIC_YEAR = CONFIG.academicYear;
const EXPECTED_INSTITUTES = CONFIG.instituteSource.expectedCount;

const VALIDATION_CONFIG = CONFIG.validation;
const MAX_ACCEPTED_PARSING_ERRORS =
  VALIDATION_CONFIG.maxAcceptedParsingErrors;

const ROOT_DIR = path.resolve(__dirname, "../..");

const DATA_DIR = process.env.CLGWISE_DATA_DIR
  ? path.resolve(process.env.CLGWISE_DATA_DIR)
  : path.join(
      ROOT_DIR,
      "lib",
      "data",
      "admissions",
      ACADEMIC_YEAR
    );

const FILES = {
  institutes: "institutes.json",
  cutoff: "cap-round-1.json",
  master: "master-colleges.json",
  report: "extraction-report.json",
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file missing: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${path.basename(filePath)}: ${error.message}`
    );
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function runScript(scriptName, env = {}) {
  const scriptPath = path.join(
    ROOT_DIR,
    "lib",
    "scrapers",
    scriptName
  );

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Scraper script not found: ${scriptPath}`);
  }

  console.log(`\nRunning ${scriptName}...`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT_DIR,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(
      `Could not execute ${scriptName}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${scriptName} failed with exit code ${result.status}`
    );
  }
}

function validateDatasets(stagingDir) {
  const instituteData = readJson(
    path.join(stagingDir, FILES.institutes)
  );

  const cutoffData = readJson(
    path.join(stagingDir, FILES.cutoff)
  );

  const institutes = Array.isArray(instituteData.institutes)
    ? instituteData.institutes
    : [];

  const colleges = Array.isArray(cutoffData.colleges)
    ? cutoffData.colleges
    : [];

  const parsing = cutoffData.parsingReport || {};

  const checks = [];

  function addCheck(name, passed, details) {
    checks.push({
      name,
      passed: Boolean(passed),
      details: String(details),
    });
  }

  // Dataset structure

  addCheck(
    "Institute dataset structure",
    institutes.length > 0,
    `Found ${institutes.length} institutes`
  );

  addCheck(
    "Cutoff dataset structure",
    colleges.length > 0,
    `Found ${colleges.length} cutoff colleges`
  );

  // Academic year and extraction status

  addCheck(
    "Institute academic year",
    instituteData.metadata?.academicYear === ACADEMIC_YEAR,
    instituteData.metadata?.academicYear ?? "Missing academic year"
  );

  addCheck(
    "Cutoff academic year",
    cutoffData.metadata?.academicYear === ACADEMIC_YEAR,
    cutoffData.metadata?.academicYear ?? "Missing academic year"
  );

  addCheck(
    "Institute extraction status",
    instituteData.metadata?.status === "verified",
    instituteData.metadata?.status ?? "Missing extraction status"
  );

  // Institute validation

  const instituteCodes = institutes.map((item) =>
    String(item?.instituteCode ?? "").trim()
  );

  const uniqueInstituteCodes = new Set(instituteCodes);

  const duplicateInstituteCount =
    instituteCodes.length - uniqueInstituteCodes.size;

  const invalidInstituteCodes = instituteCodes.filter(
    (code) => !/^\d{5}$/.test(code)
  ).length;

  addCheck(
    "Expected institute count",
    institutes.length === EXPECTED_INSTITUTES,
    `${institutes.length}/${EXPECTED_INSTITUTES}`
  );

  addCheck(
    "Institute codes valid and unique",
    invalidInstituteCodes === 0 &&
      duplicateInstituteCount <=
        VALIDATION_CONFIG.maxDuplicateInstitutes,
    `${uniqueInstituteCodes.size} unique codes, ${invalidInstituteCodes} invalid codes, ${duplicateInstituteCount} duplicates`
  );

  // Cutoff college validation

  const instituteCodeSet = new Set(instituteCodes);

  const cutoffCodes = colleges.map((item) =>
    String(item?.collegeCode ?? "").trim()
  );

  const uniqueCutoffCodes = new Set(cutoffCodes);

  const invalidCutoffCodes = cutoffCodes.filter(
    (code) => !/^\d{5}$/.test(code)
  ).length;

  const duplicateCutoffCodes =
    cutoffCodes.length - uniqueCutoffCodes.size;

  addCheck(
    "Cutoff college codes valid and unique",
    invalidCutoffCodes === 0 && duplicateCutoffCodes === 0,
    `${uniqueCutoffCodes.size} unique codes, ${invalidCutoffCodes} invalid codes, ${duplicateCutoffCodes} duplicates`
  );

  const unmatchedColleges = cutoffCodes.filter(
    (code) => !instituteCodeSet.has(code)
  );

  addCheck(
    "No unmatched cutoff colleges",
    unmatchedColleges.length <=
      VALIDATION_CONFIG.maxUnmatchedColleges,
    `${unmatchedColleges.length} unmatched colleges; maximum allowed ${VALIDATION_CONFIG.maxUnmatchedColleges}`
  );

  // Course and cutoff record validation

  let invalidCourses = 0;
  let duplicateCourseCount = 0;
  let invalidRecords = 0;
  let totalCourses = 0;
  let totalCutoffRecords = 0;

  for (const college of colleges) {
    if (!Array.isArray(college?.courses)) {
      invalidCourses++;
      continue;
    }

    const seenCourseCodes = new Set();

    for (const course of college.courses) {
      totalCourses++;

      if (!course || typeof course !== "object") {
        invalidCourses++;
        continue;
      }

      const courseCode = String(
        course.courseCode ?? ""
      ).trim();

      const isDuplicate =
        courseCode.length > 0 &&
        seenCourseCodes.has(courseCode);

      if (isDuplicate) {
        duplicateCourseCount++;
      }

      const structurallyInvalid =
        !/^\d{10}$/.test(courseCode) ||
        !course.branch ||
        !Array.isArray(course.cutoffRecords) ||
        course.cutoffRecords.length === 0;

      if (structurallyInvalid) {
        invalidCourses++;
      }

      if (courseCode) {
        seenCourseCodes.add(courseCode);
      }

      if (Array.isArray(course.cutoffRecords)) {
        for (const record of course.cutoffRecords) {
          totalCutoffRecords++;

          if (
            !record ||
            typeof record !== "object" ||
            !record.category ||
            !Number.isFinite(record.meritNumber) ||
            record.meritNumber <= 0 ||
            !Number.isFinite(record.percentile) ||
            record.percentile < 0 ||
            record.percentile > 100
          ) {
            invalidRecords++;
          }
        }
      }
    }
  }

  addCheck(
    "Course structure",
    invalidCourses === 0,
    `${totalCourses} courses, ${invalidCourses} structurally invalid`
  );

  addCheck(
    "Duplicate course codes",
    duplicateCourseCount <=
      VALIDATION_CONFIG.maxDuplicateCourses,
    `${duplicateCourseCount} duplicates; maximum allowed ${VALIDATION_CONFIG.maxDuplicateCourses}`
  );

  addCheck(
    "Cutoff record validation",
    invalidRecords === 0,
    `${totalCutoffRecords} records, ${invalidRecords} invalid`
  );

  // PDF parsing validation

  const pagesFailed = Array.isArray(parsing.pagesFailed)
    ? parsing.pagesFailed.length
    : Number(parsing.pagesFailed ?? -1);

  const parsingErrors = Array.isArray(parsing.parsingErrors)
    ? parsing.parsingErrors.length
    : Number(parsing.parsingErrors ?? -1);

  const parserDuplicateCourses = Array.isArray(
    parsing.duplicateCourses
  )
    ? parsing.duplicateCourses.length
    : Number(parsing.duplicateCourses ?? -1);

  const pagesProcessed = Number(parsing.pagesProcessed ?? 0);
  const totalPdfPages = Number(
    cutoffData.metadata?.totalPdfPages ?? 0
  );

  addCheck(
    "PDF pages processed without failures",
    Number.isFinite(pagesFailed) &&
      pagesFailed >= 0 &&
      pagesFailed <= VALIDATION_CONFIG.maxFailedPages,
    `${pagesFailed} failed pages; maximum allowed ${VALIDATION_CONFIG.maxFailedPages}`
  );

  addCheck(
    "Known parsing error threshold",
    Number.isFinite(parsingErrors) &&
      parsingErrors >= 0 &&
      parsingErrors <= MAX_ACCEPTED_PARSING_ERRORS,
    `${parsingErrors} errors; maximum ${MAX_ACCEPTED_PARSING_ERRORS}`
  );

  addCheck(
    "No parser-reported duplicate courses",
    Number.isFinite(parserDuplicateCourses) &&
      parserDuplicateCourses >= 0 &&
      parserDuplicateCourses <=
        VALIDATION_CONFIG.maxDuplicateCourses,
    `${parserDuplicateCourses} parser-reported duplicates; maximum allowed ${VALIDATION_CONFIG.maxDuplicateCourses}`
  );

  addCheck(
    "PDF page processing completed",
    Number.isFinite(pagesProcessed) &&
      pagesProcessed > 0 &&
      Number.isFinite(totalPdfPages) &&
      totalPdfPages > 0 &&
      pagesProcessed === totalPdfPages,
    `${pagesProcessed}/${totalPdfPages} pages`
  );

  return {
    passed: checks.every((item) => item.passed),
    checks,
    summary: {
      academicYear: ACADEMIC_YEAR,
      institutes: institutes.length,
      cutoffColleges: colleges.length,
      courses: totalCourses,
      cutoffRecords: totalCutoffRecords,
      pagesProcessed,
      pagesFailed,
      parsingErrors,
      parserDuplicateCourses,
      duplicateInstituteCodes: duplicateInstituteCount,
      duplicateCutoffCodes,
      unmatchedCutoffColleges: unmatchedColleges.length,
      invalidCourses,
      duplicateCourseCodes: duplicateCourseCount,
      invalidCutoffRecords: invalidRecords,
    },
  };
}

function publishSafely(stagingDir, versionId) {
  const backupDir = path.join(stagingDir, "backups");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  const filesToPublish = [...new Set(Object.values(FILES))];

  if (!filesToPublish.includes(FILES.master)) {
    throw new Error(
      `Master dataset file is missing from FILES configuration: ${FILES.master}`
    );
  }

  // Master dataset is always published last.
  const orderedFiles = [
    ...filesToPublish.filter(
      (filename) => filename !== FILES.master
    ),
    FILES.master,
  ];

  const backedUp = [];
  const published = [];

  try {
    // Verify all staging files before modifying published data.
    for (const filename of orderedFiles) {
      const stagedFile = path.join(stagingDir, filename);

      if (!fs.existsSync(stagedFile)) {
        throw new Error(
          `Validated staging file not found: ${filename}`
        );
      }
    }

    // Back up all existing published files first.
    for (const filename of orderedFiles) {
      const destination = path.join(DATA_DIR, filename);

      if (fs.existsSync(destination)) {
        const backup = path.join(backupDir, filename);

        fs.copyFileSync(destination, backup);
        backedUp.push(filename);
      }
    }

    // Publish using temporary files in the same directory.
    for (const filename of orderedFiles) {
      const stagedFile = path.join(stagingDir, filename);
      const destination = path.join(DATA_DIR, filename);

      const temporaryFile = path.join(
        DATA_DIR,
        `.${filename}.publishing`
      );

      fs.copyFileSync(stagedFile, temporaryFile);
      fs.renameSync(temporaryFile, destination);

      published.push(filename);
    }

    // Activate the version only after all dataset files are published.
    const manifest = activateVersion({
      dataDir: DATA_DIR,
      versionId,
    });

    console.log(`Active dataset version: ${manifest.activeVersion}`);

    console.log("\nAll validated datasets published successfully.");
    console.log("Master dataset published last.");

    return {
      success: true,
      publishedFiles: orderedFiles,
      rollbackSucceeded: null,
    };
  } catch (error) {
    console.error("\nPublishing failed. Rolling back...");

    const rollbackErrors = [];

    // Restore files in reverse publishing order.
    for (const filename of [...orderedFiles].reverse()) {
      const destination = path.join(DATA_DIR, filename);
      const backup = path.join(backupDir, filename);

      const temporaryRestore = path.join(
        DATA_DIR,
        `.${filename}.restoring`
      );

      try {
        if (backedUp.includes(filename) && fs.existsSync(backup)) {
          fs.copyFileSync(backup, temporaryRestore);
          fs.renameSync(temporaryRestore, destination);
        } else if (published.includes(filename)) {
          fs.rmSync(destination, { force: true });
        }
      } catch (rollbackError) {
        rollbackErrors.push({
          file: filename,
          message: rollbackError.message,
        });
      }

      // Clean up leftover temporary files.
      try {
        fs.rmSync(temporaryRestore, { force: true });
      } catch (cleanupError) {
        rollbackErrors.push({
          file: filename,
          message: `Temporary restore cleanup failed: ${cleanupError.message}`,
        });
      }

      try {
        fs.rmSync(
          path.join(DATA_DIR, `.${filename}.publishing`),
          { force: true }
        );
      } catch (cleanupError) {
        rollbackErrors.push({
          file: filename,
          message: `Temporary publish cleanup failed: ${cleanupError.message}`,
        });
      }
    }

    const rollbackSucceeded = rollbackErrors.length === 0;

    const publishError = new Error(
      `Publishing failed: ${error.message}. ` +
        (rollbackSucceeded
          ? "Rollback completed."
          : "Rollback encountered errors; published data requires inspection.")
    );

    publishError.rollbackSucceeded = rollbackSucceeded;
    publishError.rollbackErrors = rollbackErrors;
    publishError.cause = error;

    throw publishError;
  }
}

function writeFailureReport({
  stagingDir,
  startedAt,
  startTime,
  error,
  completedSteps,
  validation,
  publishedDatasetState,
}) {
  const report = {
    pipeline: "ClgWise Automated Extraction Pipeline",
    academicYear: ACADEMIC_YEAR,
    status: "failed",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationSeconds: Number(
      ((Date.now() - startTime) / 1000).toFixed(2)
    ),
    completedSteps,
    error: {
      message: error.message,
      stack: error.stack || null,
      rollbackErrors: error.rollbackErrors || [],
    },
    validation: validation || null,
    publishedFiles: [],
    publishedDatasetState,
  };

  const reportPath = path.join(stagingDir, FILES.report);

  writeJson(reportPath, report);

  console.error(`Failure report saved: ${reportPath}`);

  return reportPath;
}

function validateMasterDataset(master) {
  const checks = [];

  checks.push({
    name: "Master academic year",
    passed: master?.metadata?.academicYear === ACADEMIC_YEAR,
    details: master?.metadata?.academicYear ?? "Missing",
  });

  checks.push({
    name: "Master institute count",
    passed:
      Array.isArray(master?.institutes) &&
      master.institutes.length === EXPECTED_INSTITUTES,
    details: `${master?.institutes?.length ?? 0}/${EXPECTED_INSTITUTES}`,
  });

  checks.push({
    name: "Master unmatched cutoff colleges",
    passed:
      master?.metadata?.coverage?.unmatchedCutoffColleges === 0,
    details:
      master?.metadata?.coverage?.unmatchedCutoffColleges ??
      "Missing coverage value",
  });

  return {
    passed: checks.every((check) => check.passed),
    checks,
  };
}

async function runPipeline() {
  const startedAt = new Date();
  const startTime = Date.now();

  let stagingDir = null;
  let pipelineSucceeded = false;
  let validationResult = null;
  let publishedDatasetState = "not_modified";

  const completedSteps = [];

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // Keep staging on the same filesystem as published data.
    stagingDir = fs.mkdtempSync(
      path.join(DATA_DIR, ".staging-")
    );

    console.log("======================================");
    console.log("ClgWise Automated Extraction Pipeline");
    console.log("======================================");
    console.log(`Academic year: ${ACADEMIC_YEAR}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Staging: ${stagingDir}`);

    // Step 1: Institute extraction

    runScript("fetchInstituteList.js", {
      CLGWISE_INSTITUTES_OUTPUT: path.join(
        stagingDir,
        FILES.institutes
      ),
    });

    completedSteps.push("Institute extraction");

    // Step 2: Cutoff PDF extraction

    runScript("inspectCutoffPdf.js", {
      CLGWISE_CUTOFF_OUTPUT: path.join(
        stagingDir,
        FILES.cutoff
      ),
    });

    completedSteps.push("Cutoff PDF extraction");

    // Step 3: Dataset validation

    validationResult = validateDatasets(stagingDir);

    console.log("\nValidation results:");

    for (const item of validationResult.checks) {
      console.log(
        `${item.passed ? "PASS" : "FAIL"} - ${item.name}: ${item.details}`
      );
    }

    if (!validationResult.passed) {
      throw new Error(
        "Dataset validation failed. Published datasets were not modified."
      );
    }

    completedSteps.push("Dataset validation");

    // Step 4: Master dataset generation

    runScript("buildMasterDataset.js", {
      CLGWISE_DATA_DIR: stagingDir,
    });

    completedSteps.push("Master dataset generation");

    // Step 5: Final master integrity validation

    const master = readJson(
      path.join(stagingDir, FILES.master)
    );

    const masterValidation = validateMasterDataset(master);

    console.log("\nMaster dataset validation:");

    for (const item of masterValidation.checks) {
      console.log(
        `${item.passed ? "PASS" : "FAIL"} - ${item.name}: ${item.details}`
      );
    }

    if (!masterValidation.passed) {
      throw new Error(
        "Generated master dataset failed final integrity validation."
      );
    }

    completedSteps.push("Master dataset integrity validation");

    // Step 6: Generate machine-readable success report

    const report = {
      pipeline: "ClgWise Automated Extraction Pipeline",
      academicYear: ACADEMIC_YEAR,
      status: "validated",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationSeconds: Number(
        ((Date.now() - startTime) / 1000).toFixed(2)
      ),
      completedSteps,
      validation: validationResult,
      masterValidation,
      publishedFiles: Object.values(FILES),
    };

    writeJson(
      path.join(stagingDir, FILES.report),
      report
    );

    // Step 7: Create immutable validated version snapshot

    const version = createVersionSnapshot({
      dataDir: DATA_DIR,
      sourceDir: stagingDir,
      academicYear: ACADEMIC_YEAR,
    });

    console.log("\nValidated dataset version created.");
    console.log(`Version ID: ${version.versionId}`);

    completedSteps.push("Version snapshot creation");

    // Step 8: Safe publishing and version activation

    publishSafely(stagingDir, version.versionId);

    publishedDatasetState = "published";

    completedSteps.push("Safe publishing and version activation");

    pipelineSucceeded = true;

    console.log("\nPipeline completed successfully.");
    console.log(
      `Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`
    );
    console.log(
      `Report: ${path.join(DATA_DIR, FILES.report)}`
    );
  } catch (error) {
    console.error("\nPIPELINE FAILED");
    console.error(error.message);

    if (error.rollbackSucceeded === true) {
      publishedDatasetState = "restored_after_rollback";
    } else if (error.rollbackSucceeded === false) {
      publishedDatasetState = "rollback_failed_requires_inspection";
    }

    if (stagingDir) {
      try {
        writeFailureReport({
          stagingDir,
          startedAt,
          startTime,
          error,
          completedSteps,
          validation: validationResult,
          publishedDatasetState,
        });
      } catch (reportError) {
        console.error(
          "Could not write failure report:",
          reportError.message
        );
      }
    } else {
      console.error(
        "Staging directory could not be created. Failure report could not be saved."
      );
    }

    process.exitCode = 1;
  } finally {
    if (stagingDir && pipelineSucceeded) {
      try {
        fs.rmSync(stagingDir, {
          recursive: true,
          force: true,
        });

        console.log("Successful staging directory cleaned up.");
      } catch (cleanupError) {
        console.error(
          "Pipeline succeeded, but staging cleanup failed:",
          cleanupError.message
        );
      }
    } else if (stagingDir) {
      console.error(
        `Failed staging data preserved at: ${stagingDir}`
      );
    }
  }
}

runPipeline();
