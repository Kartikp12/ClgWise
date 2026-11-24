
const path = require("path");
const { getAdmissionsConfig } = require("./admissionsConfig");
const {
  createVersionSnapshot,
  activateVersion,
  readManifest,
} = require("./versionedAdmissionsStore");

function initializeAdmissionsVersions() {
  const config = getAdmissionsConfig();
  const academicYear = config.academicYear;

  const dataDir = path.join(
    __dirname,
    "..",
    "data",
    "admissions",
    academicYear
  );

  const manifest = readManifest(dataDir);

  if (manifest.activeVersion) {
    console.log(
      `Version history already initialized. Active version: ${manifest.activeVersion}`
    );
    return;
  }

  const version = createVersionSnapshot({
    dataDir,
    sourceDir: dataDir,
    academicYear,
  });

  activateVersion({
    dataDir,
    versionId: version.versionId,
  });

  console.log("Initial admissions version created successfully.");
  console.log(`Academic year: ${academicYear}`);
  console.log(`Version ID: ${version.versionId}`);
}

try {
  initializeAdmissionsVersions();
} catch (error) {
  console.error("Version initialization failed:", error.message);
  process.exitCode = 1;
}
