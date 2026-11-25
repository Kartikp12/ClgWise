
const assert = require("node:assert/strict");

const {
  validatePreferences,
  buildPersonalizationPrompt,
  getPersonalizedSuggestions,
} = require("./personalizedSuggestions");

const validProfile = {
  examType: "MHT-CET",
  isResultDeclared: true,
  percentile: 94,
  category: "OPEN",
  candidatureType: "Maharashtra",
  preferredBranches: ["Computer Engineering"],
  budgetMax: 150000,
  preferredCity: "Pune",
};

const samplePrediction = {
  collegeName: "Test Engineering College",
  collegeCode: "TEST001",
  branch: "Computer Engineering",
  courseCode: "TEST001123",
  historicalCutoffPercentile: 91.5,
  studentPercentile: 94,
  percentileDifference: 2.5,
  chance: "safe",
  confidence: {
    score: 50,
    level: "moderate",
  },
  branchPreferred: true,
  homeUniversityMatch: true,
};

const samplePredictionResult = {
  status: "completed",
  targetAcademicYear: "2027-28",
  referenceAcademicYear: "2026-27",
  predictionMode: "actual_percentile",
  percentileUsed: 94,
  summary: {
    total: 1,
    safe: 1,
    moderate: 0,
    ambitious: 0,
  },
  predictions: [samplePrediction],
  dataQuality: {
    categoryMappingVerified: true,
    matchingCoverage: {
      branchPreferenceApplied: true,
      homeUniversityUsedForRanking: false,
      genderApplied: false,
      specialReservationsApplied: false,
    },
  },
  categoryResolution: {
    status: "resolved",
    verified: true,
  },
  eligibility: {
    status: "rules_pending",
    eligible: null,
  },
  disclaimer:
    "Historical 2026-27 CAP Round I comparison only. Not an admission guarantee.",
};

// 1. Valid preferences
assert.deepEqual(validatePreferences(validProfile), []);

// 2. Invalid budget
assert.ok(
  validatePreferences({
    ...validProfile,
    budgetMax: -100,
  }).length > 0
);

// 3. Invalid city
assert.ok(
  validatePreferences({
    ...validProfile,
    preferredCity: 123,
  }).length > 0
);

// 4. Prompt must preserve deterministic prediction values
const prompt = buildPersonalizationPrompt(
  validProfile,
  samplePredictionResult
);

assert.equal(prompt.length, 2);
assert.equal(prompt[0].role, "system");
assert.equal(prompt[1].role, "user");

const promptContent = prompt[1].content;

assert.ok(promptContent.includes("Test Engineering College"));
assert.ok(promptContent.includes('"historicalCutoffPercentile":91.5'));
assert.ok(promptContent.includes('"chance":"safe"'));

// 5. Invalid profile must be rejected before prediction
let predictionCalled = false;

async function testInvalidProfile() {
  const result = await getPersonalizedSuggestions({
    studentProfile: {
      ...validProfile,
      percentile: 120,
    },
    predictionGenerator: () => {
      predictionCalled = true;
      return samplePredictionResult;
    },
    completionGenerator: async () => ({
      answer: "Unexpected",
      model: "test-model",
    }),
  });

  assert.equal(result.status, "invalid_profile");
  assert.equal(predictionCalled, false);
}

// 6. Category mapping pending must not call AI
async function testPendingCategoryMapping() {
  let completionCalled = false;

  const result = await getPersonalizedSuggestions({
    studentProfile: validProfile,
    dataset: { institutes: [] },
    predictionGenerator: () => ({
      status: "category_mapping_pending",
      predictions: [],
      message: "Verified category mapping is pending.",
      categoryResolution: {
        status: "mapping_pending",
      },
    }),
    completionGenerator: async () => {
      completionCalled = true;
      return {
        answer: "Unexpected",
        model: "test-model",
      };
    },
  });

  assert.equal(result.status, "category_mapping_pending");
  assert.deepEqual(result.predictions, []);
  assert.equal(completionCalled, false);
}

// 7. Successful deterministic matching and AI explanation
async function testSuccessfulSuggestions() {
  let receivedMessages = null;

  const result = await getPersonalizedSuggestions({
    studentProfile: validProfile,
    dataset: { institutes: [] },
    predictionGenerator: () => samplePredictionResult,
    completionGenerator: async (messages) => {
      receivedMessages = messages;

      return {
        answer: "This college matches your preferred branch and historical percentile comparison.",
        model: "test-model",
      };
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.guidance.length > 0, true);
  assert.equal(result.model, "test-model");

  // Deterministic prediction data must remain unchanged.
  assert.deepEqual(result.predictions, samplePredictionResult.predictions);
  assert.deepEqual(result.summary, samplePredictionResult.summary);

  // Budget and city are accepted but not falsely applied.
  assert.equal(result.preferenceCoverage.budgetApplied, false);
  assert.equal(result.preferenceCoverage.cityApplied, false);

  assert.equal(receivedMessages.length, 2);
  assert.equal(receivedMessages[0].role, "system");
  assert.equal(receivedMessages[1].role, "user");
}

async function runTests() {
  await testInvalidProfile();
  await testPendingCategoryMapping();
  await testSuccessfulSuggestions();

  console.log("Personalized Suggestions validation tests passed.");
  console.log("Category mapping pending safety test passed.");
  console.log("Deterministic matching and AI explanation tests passed.");
  console.log("All Personalized College Suggestions tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
