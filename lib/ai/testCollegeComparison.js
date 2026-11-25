
const assert = require("node:assert/strict");

const {
  validateInstituteCodes,
  getOpenCutoffs,
  buildCollegeOverview,
  buildBranchComparison,
  buildOpenCutoffComparison,
  buildCollegeComparisonData,
  buildComparisonPrompt,
  compareColleges,
} = require("./collegeComparison");

const testDataset = {
  metadata: {
    academicYear: "2026-27",
  },
  institutes: [
    {
      instituteCode: "01001",
      instituteName: "Test Engineering College A",
      cutoffAvailable: true,
      cutoffRound: "CAP Round I",
      courses: [
        {
          courseCode: "1001",
          branch: "Computer Engineering",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [
            { category: "GOPENS", meritNumber: 1200, percentile: 98.5 },
            { category: "LOPENS", meritNumber: 1300, percentile: 98.1 },
            { category: "GOBCS", meritNumber: 1500, percentile: 97.5 },
          ],
        },
        {
          courseCode: "1002",
          branch: "Mechanical Engineering",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [
            { category: "GOPENS", meritNumber: 5000, percentile: 90.5 },
          ],
        },
        {
          courseCode: "1003",
          branch: "Civil Engineering",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [],
        },
      ],
    },
    {
      instituteCode: "01002",
      instituteName: "Test Engineering College B",
      cutoffAvailable: true,
      cutoffRound: "CAP Round I",
      courses: [
        {
          courseCode: "2001",
          branch: "Computer Engineering",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [
            { category: "GOPENS", meritNumber: 1800, percentile: 97.2 },
            { category: "LOPENS", meritNumber: 1900, percentile: 96.8 },
          ],
        },
        {
          courseCode: "2002",
          branch: "Information Technology",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [
            { category: "GOPENS", meritNumber: 2200, percentile: 96.5 },
          ],
        },
      ],
    },
    {
      instituteCode: "01003",
      instituteName: "Test Engineering College C",
      cutoffAvailable: false,
      cutoffRound: null,
      courses: [
        {
          courseCode: "3001",
          branch: "Computer Engineering",
          status: "Active",
          homeUniversity: "SPPU",
          cutoffRecords: [],
        },
      ],
    },
  ],
};

async function runTests() {
  // 1. Institute code validation
  assert.equal(validateInstituteCodes(["01001", "01002"]).valid, true);
  assert.equal(
    validateInstituteCodes(["01001", "01002", "01003"]).valid,
    true
  );
  assert.equal(
    validateInstituteCodes(["01001", "01002", "01003", "01004"]).valid,
    true
  );
  assert.equal(validateInstituteCodes(["01001"]).valid, false);
  assert.equal(
    validateInstituteCodes(["01001", "01002", "01003", "01004", "01005"]).valid,
    false
  );
  assert.equal(validateInstituteCodes(["01001", "01001"]).valid, false);
  assert.equal(validateInstituteCodes(["01001", 1002]).valid, false);

  console.log("Institute code validation tests passed.");

  // 2. OPEN cutoff filtering
  const openCutoffs = getOpenCutoffs(
    testDataset.institutes[0].courses[0]
  );

  assert.equal(openCutoffs.length, 1);
  assert.equal(openCutoffs[0].category, "GOPENS");
  assert.equal(openCutoffs[0].percentile, 98.5);
  assert.equal(
    openCutoffs.some((record) => record.category === "LOPENS"),
    false
  );

  console.log("OPEN category filtering tests passed.");

  // 3. College overview
  const overview = buildCollegeOverview(
    testDataset.institutes.slice(0, 2),
    "2026-27"
  );

  assert.equal(overview.length, 2);
  assert.equal(overview[0].instituteCode, "01001");
  assert.equal(overview[0].totalBranches, 3);
  assert.equal(overview[0].branches[0].branch, "Computer Engineering");
  assert.equal(
    overview[0].dataAvailability.fees,
    "not_available_in_current_dataset"
  );
  assert.equal(
    overview[0].dataAvailability.placements,
    "not_available_in_current_dataset"
  );

  console.log("College overview tests passed.");

  // 4. Branch comparison
  const branchComparison = buildBranchComparison(
    testDataset.institutes.slice(0, 2)
  );

  assert.ok(
    branchComparison.commonBranches.includes("Computer Engineering")
  );

  assert.equal(branchComparison.commonBranchCount, 1);

  assert.ok(
    branchComparison.collegeSpecificBranches[0].branches.includes(
      "Mechanical Engineering"
    )
  );

  assert.ok(
    branchComparison.collegeSpecificBranches[1].branches.includes(
      "Information Technology"
    )
  );

  console.log("Common and college-specific branch tests passed.");

  // 5. OPEN cutoff comparison
  const cutoffComparison = buildOpenCutoffComparison(
    testDataset.institutes.slice(0, 2)
  );

  assert.equal(cutoffComparison.category, "GOPENS");

  const computerBranch = cutoffComparison.branches.find(
    (branch) => branch.branch === "Computer Engineering"
  );

  assert.ok(computerBranch);
  assert.equal(computerBranch.status, "comparable");
  assert.equal(computerBranch.colleges.length, 2);

  assert.equal(
    computerBranch.colleges[0].cutoffRecords[0].percentile,
    98.5
  );

  assert.equal(
    computerBranch.colleges[1].cutoffRecords[0].percentile,
    97.2
  );

  assert.equal(
    computerBranch.colleges[0].cutoffRecords.some(
      (record) => record.category !== "GOPENS"
    ),
    false
  );

  const mechanicalBranch = cutoffComparison.branches.find(
    (branch) => branch.branch === "Mechanical Engineering"
  );

  assert.equal(mechanicalBranch.status, "partially_available");
  assert.equal(mechanicalBranch.colleges[1].available, false);

  const informationTechnology = cutoffComparison.branches.find(
    (branch) => branch.branch === "Information Technology"
  );

  assert.equal(informationTechnology.status, "partially_available");
  assert.equal(informationTechnology.colleges[0].available, false);

  console.log("OPEN cutoff comparison and missing data tests passed.");

  // 6. Unified four-section comparison data
  const comparisonData = buildCollegeComparisonData(
    ["01001", "01002"],
    testDataset
  );

  assert.equal(comparisonData.status, "completed");
  assert.equal(comparisonData.collegeOverview.length, 2);
  assert.ok(comparisonData.branchComparison);
  assert.ok(comparisonData.openCutoffComparison);
  assert.ok(comparisonData.source);

  console.log("Four-section comparison data tests passed.");

  // 7. Missing college handling
  const missingData = buildCollegeComparisonData(
    ["01001", "99999"],
    testDataset
  );

  assert.equal(missingData.status, "colleges_not_found");
  assert.deepEqual(missingData.missingCodes, ["99999"]);

  console.log("Missing college handling tests passed.");

  // 8. Prompt safety
  const prompt = buildComparisonPrompt(comparisonData);
  const systemPrompt = prompt[0].content;
  const userPrompt = JSON.parse(prompt[1].content);

  assert.ok(systemPrompt.includes("Never invent"));
  assert.ok(systemPrompt.includes("GOPENS"));
  assert.ok(systemPrompt.includes("LOPENS"));
  assert.ok(systemPrompt.includes("2026-27 CAP Round I"));

  assert.ok(userPrompt.collegeOverview);
  assert.ok(userPrompt.branchComparison);
  assert.ok(userPrompt.openCutoffComparison);

  assert.equal(
    userPrompt.openCutoffComparison.category,
    "GOPENS"
  );

  console.log("AI prompt safety and structured data tests passed.");

  // 9. Invalid input must not call Groq
  let groqCalls = 0;

  const mockCompletion = async () => {
    groqCalls += 1;
    return {
      answer: "Mock AI analysis",
      model: "test-model",
    };
  };

  const invalidResult = await compareColleges({
    instituteCodes: ["01001"],
    dataset: testDataset,
    completionGenerator: mockCompletion,
  });

  assert.equal(invalidResult.status, "invalid_request");
  assert.equal(groqCalls, 0);

  console.log("Invalid request safety test passed.");

  // 10. Missing college must not call Groq
  const missingResult = await compareColleges({
    instituteCodes: ["01001", "99999"],
    dataset: testDataset,
    completionGenerator: mockCompletion,
  });

  assert.equal(missingResult.status, "colleges_not_found");
  assert.equal(groqCalls, 0);

  console.log("Missing college safety test passed.");

  // 11. Successful AI comparison flow
  const successfulResult = await compareColleges({
    instituteCodes: ["01001", "01002"],
    dataset: testDataset,
    completionGenerator: mockCompletion,
  });

  assert.equal(successfulResult.status, "completed");
  assert.equal(successfulResult.aiAnalysis, "Mock AI analysis");
  assert.equal(successfulResult.comparison, "Mock AI analysis");
  assert.equal(successfulResult.model, "test-model");
  assert.equal(successfulResult.collegeOverview.length, 2);
  assert.ok(successfulResult.branchComparison);
  assert.ok(successfulResult.openCutoffComparison);
  assert.equal(groqCalls, 1);

  assert.ok(
    successfulResult.disclaimer.includes("not an official")
  );

  assert.ok(
    successfulResult.limitations.some((item) => /fees/i.test(item))
  );

  assert.ok(
    successfulResult.limitations.some((item) => /placement/i.test(item))
  );

  console.log("Successful AI comparison flow tests passed.");

  // 12. Four-college comparison
  const fourCollegeResult = await compareColleges({
    instituteCodes: ["01001", "01002", "01003", "01001"],
    dataset: testDataset,
    completionGenerator: mockCompletion,
  });

  assert.equal(fourCollegeResult.status, "invalid_request");

  console.log("Duplicate institute protection passed.");

  console.log("\nAll College Comparison unit tests passed.");
}

runTests().catch((error) => {
  console.error("\nCollege Comparison tests failed:", error);
  process.exitCode = 1;
});
