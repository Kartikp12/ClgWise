
const assert = require("node:assert/strict");

const dataset = require("../data/admissions/2026-27/master-colleges.json");

const { generatePredictions } = require("./predictionEngine");

const { resolveStudentCategory } = require("../matching/categoryResolver");

assert.equal(dataset.metadata.academicYear, "2026-27");
assert.equal(dataset.institutes.length, 387);

const profile = {
  examType: "MHT-CET",
  percentile: 95,
  category: "OPEN",
  candidatureType: "Maharashtra",
  preferredBranches: [],
  isResultDeclared: true,
};

const categoryResult = resolveStudentCategory(profile);

// Official category mapping is intentionally pending.
// Use an explicit historical cutoff category only for this integration test.
const result = generatePredictions({
  colleges: dataset.institutes,
  studentProfile: profile,
  cutoffCategories: ["GOPENS"],
});

assert.equal(result.status, "completed");
assert.ok(result.predictions.length > 0);

const uniqueColleges = new Set(
  result.predictions.map((item) => item.collegeCode)
);

console.log({
  datasetInstitutes: dataset.institutes.length,
  datasetCourses: dataset.metadata.coverage.totalCourses,
  categoryMappingStatus: categoryResult.status,
  predictionsGenerated: result.predictions.length,
  uniqueCollegesMatched: uniqueColleges.size,
  summary: result.summary,
});


const confidenceDistribution = {};

for (const prediction of result.predictions) {
  const score = prediction.confidence.score;

  confidenceDistribution[score] =
    (confidenceDistribution[score] || 0) + 1;

  assert.equal(
    prediction.confidence.factors.matchingCategory,
    false
  );
}

assert.equal(
  result.predictions.every(
    (prediction) => prediction.confidence.score === 50
  ),
  true
);

console.log("\nConfidence Distribution:");
console.log(confidenceDistribution);

console.log(
  "All predictions correctly exclude unverified category confidence."
);



console.log("\nActual dataset integration test passed.");
