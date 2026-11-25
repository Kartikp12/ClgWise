
const assert = require("assert");

const masterDataset = require("../data/admissions/2026-27/master-colleges.json");

const {
  analyzeCapChoices,
} = require("./capChoiceGuidance");

const {
  generatePredictions,
} = require("../prediction/predictionEngine");

async function runIntegrationTests() {
  let passed = 0;

  function test(name, callback) {
    callback();
    passed++;
    console.log(`PASS: ${name}`);
  }

  const institutes = masterDataset.institutes || [];

  assert.ok(institutes.length > 0, "Master dataset contains no institutes.");

  const institute = institutes.find(
    (item) =>
      item.instituteCode &&
      Array.isArray(item.courses) &&
      item.courses.some((course) => course.courseCode)
  );

  assert.ok(institute, "No institute with a valid course was found.");

  const course = institute.courses.find(
    (item) => item.courseCode
  );

  const studentProfile = {
    examType: "MHT-CET",
    isResultDeclared: true,
    percentile: 90,
    category: "OPEN",
    candidatureType: "Maharashtra State",
  };

  const validPayload = {
    studentProfile,
    choices: [
      {
        instituteCode: institute.instituteCode,
        courseCode: course.courseCode,
      },
    ],
  };

  test("Loads the actual admissions master dataset", () => {
    assert.ok(institutes.length > 0);
    assert.ok(institute.instituteName);
    assert.ok(course.courseCode);

    console.log(`  Institutes available: ${institutes.length}`);
    console.log(`  Test institute: ${institute.instituteName}`);
    console.log(`  Test course: ${course.branch || course.courseCode}`);
  });

  const result = await analyzeCapChoices(validPayload);

  test("Verifies a real institute and course from the dataset", () => {
    assert.strictEqual(
      result.structuralReview.verifiedChoices,
      1
    );

    assert.strictEqual(
      result.structuralReview.choices[0].status,
      "verified_in_dataset"
    );
  });

  test("Preserves the original preference order", () => {
    assert.strictEqual(
      result.structuralReview.preferenceOrderPreserved,
      true
    );

    assert.strictEqual(
      result.structuralReview.choices[0].originalPosition,
      1
    );
  });

  test("Uses the real prediction engine", () => {
    const predictionResult = generatePredictions({
      colleges: institutes,
      studentProfile,
    });

    assert.strictEqual(
      predictionResult.status,
      "category_mapping_pending"
    );

    assert.strictEqual(
      predictionResult.predictions.length,
      0
    );
  });

  test("Does not generate cutoff guidance with pending category mapping", () => {
    assert.strictEqual(
      result.status,
      "category_mapping_pending"
    );

    assert.strictEqual(
      result.predictionStatus,
      "not_generated"
    );

    assert.strictEqual(
      result.aiGuidanceStatus,
      "not_generated"
    );
  });

  test("Rejects an institute that does not exist in the actual dataset", async () => {
    const invalidResult = await analyzeCapChoices({
      studentProfile,
      choices: [
        {
          instituteCode: "INVALID-INSTITUTE",
          courseCode: "INVALID-COURSE",
        },
      ],
    });

    assert.strictEqual(
      invalidResult.status,
      "choice_validation_failed"
    );

    assert.strictEqual(
      invalidResult.structuralReview.invalidChoices,
      1
    );
  });

  console.log(`\n${passed} integration tests passed successfully.`);
}

runIntegrationTests().catch((error) => {
  console.error("\nINTEGRATION TEST FAILURE:", error);
  process.exitCode = 1;
});
