
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILES = [
  "institutes.json",
  "cap-round-1.json",
  "master-colleges.json",
  "extraction-report.json",
];

const MANIFEST_FILE = "version-manifest.json";

function getPaths(dataDir) {
  return {
    manifestPath: path.join(dataDir, MANIFEST_FILE),
    versionsDir: path.join(dataDir, "versions"),
  };
}

function calculateChecksum(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function writeJsonAtomically(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

function readManifest(dataDir) {
  const { manifestPath } = getPaths(dataDir);

  if (!fs.existsSync(manifestPath)) {
    return {
      academicYear: null,
      activeVersion: null,
      versions: [],
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (!Array.isArray(manifest.versions)) {
    throw new Error("Invalid version manifest: versions must be an array.");
  }

  return manifest;
}

function generateVersionId() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.]/g, "")
    .replace("T", "T")
    .replace("Z", "Z");

  return `${timestamp}-${crypto.randomBytes(3).toString("hex")}`;
}

function createVersionSnapshot({
  dataDir,
  sourceDir,
  academicYear,
}) {
  if (!dataDir || !sourceDir || !academicYear) {
    throw new Error("dataDir, sourceDir and academicYear are required.");
  }

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });

  const { versionsDir, manifestPath } = getPaths(dataDir);
  fs.mkdirSync(versionsDir, { recursive: true });

  const manifest = readManifest(dataDir);

  if (
    manifest.academicYear &&
    manifest.academicYear !== academicYear
  ) {
    throw new Error(
      `Academic year mismatch: ${manifest.academicYear} vs ${academicYear}`
    );
  }

  const files = DATA_FILES.filter((file) =>
    fs.existsSync(path.join(sourceDir, file))
  );

  const requiredFiles = DATA_FILES.filter(
    (file) => file !== "extraction-report.json"
  );

  for (const file of requiredFiles) {
    if (!files.includes(file)) {
      throw new Error(`Required dataset file missing: ${file}`);
    }
  }

  const versionId = generateVersionId();
  const versionDir = path.join(versionsDir, versionId);

  fs.mkdirSync(versionDir, { recursive: false });

  try {
    const checksums = {};

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destinationPath = path.join(versionDir, file);

      fs.copyFileSync(sourcePath, destinationPath);
      checksums[file] = calculateChecksum(destinationPath);
    }

    const version = {
      versionId,
      academicYear,
      createdAt: new Date().toISOString(),
      files,
      checksums,
    };

    writeJsonAtomically(
      path.join(versionDir, "version.json"),
      version
    );

    for (const file of files) {
      const snapshotPath = path.join(versionDir, file);

      if (calculateChecksum(snapshotPath) !== checksums[file]) {
        throw new Error(`Snapshot checksum verification failed: ${file}`);
      }
    }

    const updatedManifest = {
      academicYear,
      activeVersion: manifest.activeVersion,
      versions: [
        ...manifest.versions,
        {
          versionId,
          createdAt: version.createdAt,
          files,
          checksums,
        },
      ],
    };

    writeJsonAtomically(manifestPath, updatedManifest);

    return version;
  } catch (error) {
    fs.rmSync(versionDir, { recursive: true, force: true });
    throw error;
  }
}

function verifyVersion({ dataDir, versionId }) {
  const { versionsDir } = getPaths(dataDir);
  const versionDir = path.join(versionsDir, versionId);
  const versionPath = path.join(versionDir, "version.json");

  if (!fs.existsSync(versionPath)) {
    throw new Error(`Version not found: ${versionId}`);
  }

  const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));

  for (const file of version.files) {
    const filePath = path.join(versionDir, file);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Version file missing: ${file}`);
    }

    if (calculateChecksum(filePath) !== version.checksums[file]) {
      throw new Error(`Checksum mismatch: ${file}`);
    }
  }

  return version;
}

function activateVersion({ dataDir, versionId }) {
  const manifest = readManifest(dataDir);

  const exists = manifest.versions.some(
    (version) => version.versionId === versionId
  );

  if (!exists) {
    throw new Error(`Version is not registered: ${versionId}`);
  }

  verifyVersion({ dataDir, versionId });

  const updatedManifest = {
    ...manifest,
    activeVersion: versionId,
  };

  writeJsonAtomically(
    getPaths(dataDir).manifestPath,
    updatedManifest
  );

  return updatedManifest;
}

function rollbackVersion({ dataDir, versionId }) {
  const manifest = readManifest(dataDir);

  if (!manifest.versions.some((version) => version.versionId === versionId)) {
    throw new Error(`Cannot rollback: version not found: ${versionId}`);
  }

  const version = verifyVersion({ dataDir, versionId });
  const { versionsDir, manifestPath } = getPaths(dataDir);
  const versionDir = path.join(versionsDir, versionId);

  const backupDir = path.join(
    dataDir,
    `.rollback-backup-${crypto.randomBytes(4).toString("hex")}`
  );

  fs.mkdirSync(backupDir);

  const replacedFiles = [];

  try {
    for (const file of version.files) {
      const currentPath = path.join(dataDir, file);

      if (fs.existsSync(currentPath)) {
        fs.copyFileSync(currentPath, path.join(backupDir, file));
      }

      replacedFiles.push(file);

      const tempPath = `${currentPath}.${process.pid}.tmp`;
      fs.copyFileSync(path.join(versionDir, file), tempPath);
      fs.renameSync(tempPath, currentPath);
    }

    const updatedManifest = {
      ...manifest,
      activeVersion: versionId,
    };

    writeJsonAtomically(manifestPath, updatedManifest);

    return updatedManifest;
  } catch (error) {
    for (const file of replacedFiles.reverse()) {
      const currentPath = path.join(dataDir, file);
      const backupPath = path.join(backupDir, file);

      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, currentPath);
      } else {
        fs.rmSync(currentPath, { force: true });
      }
    }

    throw error;
  } finally {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

module.exports = {
  createVersionSnapshot,
  verifyVersion,
  activateVersion,
  rollbackVersion,
  readManifest,
};
