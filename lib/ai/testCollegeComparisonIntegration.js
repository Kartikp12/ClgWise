
const assert = require("node:assert/strict");

const masterDataset = require("../data/admissions/2026-27/master-colleges.json");

const {
  buildCollegeComparisonData,
} = require("./collegeComparison");

const INSTITUTE_CODES = ["06155", "04116"];

function normalizeBranch(branch) {
  return String(branch || "").trim().toLowerCase();
}

function runIntegrationTest() {
  console.log("\nStarting real college comparison integration test...\n");

  // 1. Verify selected colleges exist in the actual dataset.
  const selectedInstitutes = INSTITUTE_CODES.map((code) =>
    masterDataset.institutes.find(
      (institute) =>
        String(institute.instituteCode).trim() === code
    )
  );

  assert.ok(
    selectedInstitutes.every(Boolean),
    "Selected institutes must exist in the actual dataset."
  );

  const [collegeA, collegeB] = selectedInstitutes;

  console.log("Selected colleges:");
  console.log(`${collegeA.instituteName} (${collegeA.instituteCode})`);
  console.log(`${collegeB.instituteName} (${collegeB.instituteCode})`);

  // 2. Build comparison using the actual dataset.
  const result = buildCollegeComparisonData(
    INSTITUTE_CODES,
    masterDataset
  );

  assert.equal(result.status, "completed");

  // 3. College Overview checks.
  assert.equal(result.collegeOverview.length, 2);

  result.collegeOverview.forEach((college, index) => {
    assert.equal(
      String(college.instituteCode),
      INSTITUTE_CODES[index]
    );

    assert.ok(college.instituteName);
    assert.ok(Array.isArray(college.branches));
    assert.ok(college.branches.length > 0);

    assert.equal(
      college.dataAvailability.fees,
      "not_available_in_current_dataset"
    );

    assert.equal(
      college.dataAvailability.placements,
      "not_available_in_current_dataset"
    );

    assert.equal(
      college.dataAvailability.verifiedLocation,
      "not_available_in_current_dataset"
    );

    console.log(`\nOverview verified: ${college.instituteName}`);
    console.log(`Branches included: ${college.branches.length}`);
  });

  // 4. Branch Comparison checks.
  const branchComparison = result.branchComparison;

  assert.ok(Array.isArray(branchComparison.commonBranches));
  assert.ok(Array.isArray(branchComparison.collegeSpecificBranches));
  assert.ok(Array.isArray(branchComparison.colleges));

  assert.equal(branchComparison.colleges.length, 2);
  assert.ok(branchComparison.commonBranchCount > 0);

  console.log("\nCommon branches:");

  branchComparison.commonBranches.forEach((branch) => {
    console.log(`- ${branch}`);
  });

  branchComparison.colleges.forEach((college, index) => {
    assert.equal(
      String(college.instituteCode),
      INSTITUTE_CODES[index]
    );

    assert.ok(Array.isArray(college.branches));
    assert.ok(college.totalBranches > 0);
  });

  // Verify common branches really exist in both actual colleges.
  const actualBranchesA = new Set(
    collegeA.courses.map((course) => normalizeBranch(course.branch))
  );

  const actualBranchesB = new Set(
    collegeB.courses.map((course) => normalizeBranch(course.branch))
  );

  branchComparison.commonBranches.forEach((branch) => {
    const normalized = normalizeBranch(branch);

    assert.ok(actualBranchesA.has(normalized));
    assert.ok(actualBranchesB.has(normalized));
  });

  console.log("\nBranch comparison checks passed.");

  // 5. OPEN / GOPENS cutoff comparison checks.
  const openComparison = result.openCutoffComparison;

  assert.equal(openComparison.category, "GOPENS");
  assert.equal(openComparison.admissionRound, "CAP Round I");
  assert.ok(Array.isArray(openComparison.branches));

  let verifiedOpenCutoffs = 0;

  for (const branchComparison of openComparison.branches) {
    const collegeEntries = branchComparison.colleges;

    assert.equal(collegeEntries.length, 2);

    collegeEntries.forEach((entry, index) => {
      assert.equal(entry.category, "GOPENS");

      if (entry.available) {
        assert.ok(Array.isArray(entry.cutoffRecords));
        assert.ok(entry.cutoffRecords.length > 0);

        entry.cutoffRecords.forEach((record) => {
          assert.equal(record.category, "GOPENS");

          if (record.percentile !== null) {
            assert.equal(typeof record.percentile, "number");
            assert.ok(
              record.percentile >= 0 && record.percentile <= 100
            );
          }

          if (record.meritNumber !== null) {
            assert.equal(typeof record.meritNumber, "number");
            assert.ok(record.meritNumber > 0);
          }
        });
      } else {
        assert.equal(entry.cutoffRecords.length, 0);
      }
    });

    if (branchComparison.status === "comparable") {
      assert.ok(
        collegeEntries.every((entry) => entry.available),
        "Comparable branches must have cutoffs in both colleges."
      );

      verifiedOpenCutoffs++;
      console.log(`OPEN cutoff verified: ${branchComparison.branch}`);
    }
  }

  assert.ok(
    verifiedOpenCutoffs > 0,
    "At least one common branch must have GOPENS cutoffs in both colleges."
  );

  // 6. Verify cutoff values against the original dataset.
  for (const entry of openComparison.branches) {
    entry.colleges.forEach((collegeEntry) => {
      const sourceInstitute = masterDataset.institutes.find(
        (institute) =>
          String(institute.instituteCode) ===
          String(collegeEntry.instituteCode)
      );

      const sourceCourse = sourceInstitute.courses.find(
        (course) =>
          normalizeBranch(course.branch) ===
          normalizeBranch(entry.branch)
      );

      const sourceCutoffs = (sourceCourse?.cutoffRecords || [])
        .filter((record) => record.category === "GOPENS");

      assert.equal(
        collegeEntry.cutoffRecords.length,
        sourceCutoffs.length,
        `GOPENS cutoff count mismatch for ${entry.branch}`
      );
    });
  }

  // 7. Source and historical data checks.
  assert.equal(
    result.source.academicYear,
    masterDataset.metadata.academicYear
  );

  assert.equal(result.source.admissionRound, "CAP Round I");
  assert.ok(result.disclaimer.includes("not an official college ranking"));

  assert.ok(
    result.limitations.some((item) => /fees/i.test(item))
  );

  assert.ok(
    result.limitations.some((item) => /placement/i.test(item))
  );

  assert.ok(
    result.limitations.some((item) => /location/i.test(item))
  );

  console.log("\nCollege Overview checks passed.");
  console.log("Branch Comparison checks passed.");
  console.log(
    `OPEN Cutoff checks passed: ${verifiedOpenCutoffs} comparable branches.`
  );
  console.log("Source data and availability checks passed.");

  console.log(
    "\nAll real college comparison integration checks passed."
  );
}

try {
  runIntegrationTest();
} catch (error) {
  console.error("\nIntegration test failed:", error);
  process.exitCode = 1;
}
