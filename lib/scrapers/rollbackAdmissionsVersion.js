
const path = require("path");
const { getAdmissionsConfig } = require("./admissionsConfig");
const { rollbackVersion } = require("./versionedAdmissionsStore");

function rollbackAdmissionsVersion() {
  const versionId = process.argv[2];

  if (!versionId) {
    throw new Error(
      "Version ID required. Example: npm run rollback:admissions -- VERSION_ID"
    );
  }

  const config = getAdmissionsConfig();

  const dataDir = path.join(
    __dirname,
    "..",
    "data",
    "admissions",
    config.academicYear
  );

  const manifest = rollbackVersion({
    dataDir,
    versionId,
  });

  console.log("Admissions dataset rollback successful.");
  console.log(`Academic year: ${config.academicYear}`);
  console.log(`Active version: ${manifest.activeVersion}`);
}

try {
  rollbackAdmissionsVersion();
} catch (error) {
  console.error("Admissions rollback failed:", error.message);
  process.exitCode = 1;
}
