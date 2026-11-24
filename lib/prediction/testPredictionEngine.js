
const assert = require("node:assert/strict");

const {
  validateStudentProfile,
  evaluateEligibility,
} = require("../eligibility/eligibilityEngine");

const {
  resolveStudentCategory,
} = require("../matching/categoryResolver");

const {
  matchColleges,
} = require("../matching/collegeMatcher");

const {
  classifyAdmissionChance,
} = require("./chanceClassifier");

const {
  calculatePredictionConfidence,
} = require("./confidenceCalculator");

const {
  generatePredictions,
} = require("./predictionEngine");

const sampleColleges = [
  {
    collegeCode: "01002",
    collegeName: "Government College of Engineering, Amravati",
    courses: [
      {
        courseCode: "0100219110",
        branch: "Civil Engineering",
        cutoffRecords: [
          {
            category: "GOPENS",
            meritNumber: 34692,
            percentile: 91.78,
          },
        ],
      },
    ],
  },
];

const validProfile = {
  examType: "MHT-CET",
  percentile: 94,
  category: "OPEN",
  candidatureType: "Maharashtra",
  preferredBranches: ["Civil Engineering"],
  isResultDeclared: true,
};

// 1. Profile validation
assert.equal(
  validateStudentProfile(validProfile).valid,
  true
);

assert.equal(
  validateStudentProfile({
    ...validProfile,
    percentile: 120,
  }).valid,
  false
);


assert.equal(
    validateStudentProfile({
      ...validProfile,
      examType: "JEE Main",
    }).valid,
    false
  );


 // Additional student profile validation tests

assert.equal(
    validateStudentProfile({
      ...validProfile,
      gender: 123,
    }).valid,
    false
  );
  
  assert.equal(
    validateStudentProfile({
      ...validProfile,
      homeUniversity: 123,
    }).valid,
    false
  );
  
  assert.equal(
    validateStudentProfile({
      ...validProfile,
      specialReservations: "PWD",
    }).valid,
    false
  );
  
  assert.equal(
    validateStudentProfile({
      ...validProfile,
      preferredBranches: ["Computer Engineering", 123],
    }).valid,
    false
  );
  
  // Valid optional profile fields
  assert.equal(
    validateStudentProfile({
      ...validProfile,
      gender: "Male",
      homeUniversity: "Pune University",
      specialReservations: ["TFWS"],
      preferredBranches: ["Computer Engineering"],
    }).valid,
    true
  );
  
  

// 2. Official rules must not be assumed available
assert.equal(
  evaluateEligibility(validProfile).status,
  "rules_pending"
);

// 3. Category mapping must remain pending until configured
assert.equal(
  resolveStudentCategory(validProfile).status,
  "mapping_pending"
);

// 4. Historical cutoff matching
const matchingResult = matchColleges({
  colleges: sampleColleges,
  percentile: 94,
  cutoffCategories: ["GOPENS"],
  preferredBranches: ["Civil Engineering"],
});

assert.equal(matchingResult.status, "completed");
assert.equal(matchingResult.totalMatches, 1);
assert.equal(matchingResult.matches[0].meetsHistoricalCutoff, true);
assert.equal(matchingResult.matches[0].branchPreferred, true);

// 5. Chance classification
assert.equal(
  classifyAdmissionChance(3).classification,
  "safe"
);

assert.equal(
  classifyAdmissionChance(0).classification,
  "moderate"
);

assert.equal(
  classifyAdmissionChance(-3).classification,
  "ambitious"
);

// 6. Confidence must remain capped
const confidence = calculatePredictionConfidence({
  historicalCutoff: true,
  matchingCategory: true,
  matchingExam: true,
  matchingAcademicYear: true,
});

assert.equal(confidence.score, 60);


 // 7. End-to-end prediction with unverified category mapping
 const predictionResult = generatePredictions({
    colleges: sampleColleges,
    studentProfile: validProfile,
    cutoffCategories: ["GOPENS"],
  });
  
  assert.equal(predictionResult.status, "completed");
  assert.equal(predictionResult.summary.total, 1);
  assert.equal(predictionResult.predictions[0].chance, "safe");
  
  // Category mapping is not verified, so its confidence points must not be awarded.
  assert.equal(
    predictionResult.predictions[0].confidence.factors.matchingCategory,
    false
  );
  
  assert.equal(
    predictionResult.predictions[0].confidence.score,
    50
  );
  
  // 8. Verified category mapping
  const verifiedResult = generatePredictions({
    colleges: sampleColleges,
    studentProfile: validProfile,
    cutoffCategories: ["GOPENS"],
    categoryMappingVerified: true,
  });
  
  assert.equal(
    verifiedResult.predictions[0].confidence.factors.matchingCategory,
    true
  );
  
  assert.equal(
    verifiedResult.predictions[0].confidence.score,
    60
  );

  // 10. Courses without cutoff data must not be treated as ineligible
const missingCutoffResult = matchColleges({
    colleges: [
      {
        instituteCode: "9999",
        instituteName: "Test Institute",
        cutoffAvailable: false,
        courses: [],
      },
      {
        instituteCode: "9998",
        instituteName: "Partial Data Institute",
        cutoffAvailable: true,
        courses: [
          {
            courseCode: "1234",
            branch: "Computer Engineering",
            cutoffRecords: [],
          },
        ],
      },
    ],
    percentile: 95,
    cutoffCategories: ["GOPENS"],
  });
  
  assert.equal(missingCutoffResult.status, "completed");
  assert.equal(missingCutoffResult.matches.length, 0);
  assert.equal(missingCutoffResult.coursesWithoutCutoff, 1);
  
  console.log("Missing cutoff data test passed.");
  
  console.log("\nAll Task 7 engine tests passed successfully.");



 // 9. Prediction engine must reject invalid profiles

const invalidPrediction = generatePredictions({
    colleges: sampleColleges,
    studentProfile: {
      ...validProfile,
      percentile: 120,
    },
    cutoffCategories: ["GOPENS"],
  });
  
  assert.equal(invalidPrediction.status, "invalid_profile");
  assert.equal(invalidPrediction.predictions.length, 0);
  assert.ok(invalidPrediction.errors.length > 0);
  
  // Unsupported exam must also be rejected
  const unsupportedPrediction = generatePredictions({
    colleges: sampleColleges,
    studentProfile: {
      ...validProfile,
      examType: "JEE Main",
    },
    cutoffCategories: ["GOPENS"],
  });
  
  assert.equal(unsupportedPrediction.status, "invalid_profile");
  assert.equal(unsupportedPrediction.predictions.length, 0);
  
  // 11. Test admission chance classification boundaries
assert.equal(classifyAdmissionChance(2).classification, "safe");
assert.equal(classifyAdmissionChance(5).classification, "safe");

assert.equal(classifyAdmissionChance(0).classification, "moderate");
assert.equal(classifyAdmissionChance(-2).classification, "moderate");

assert.equal(classifyAdmissionChance(-3).classification, "ambitious");
assert.equal(classifyAdmissionChance(-10).classification, "ambitious");

// 12. Validate result declaration flag
const invalidResultFlag = validateStudentProfile({
    ...validProfile,
    isResultDeclared: "yes",
  });
  
  assert.equal(invalidResultFlag.valid, false);
  assert.ok(
    invalidResultFlag.errors.some((error) =>
      error.includes("isResultDeclared")
    )
  );
  
  const expectedMode = generatePredictions({
    colleges: sampleColleges,
    studentProfile: { ...validProfile, isResultDeclared: false },
    cutoffCategories: ["GOPENS"],
    categoryMappingVerified: true,
  });
  
  const actualMode = generatePredictions({
    colleges: sampleColleges,
    studentProfile: { ...validProfile, isResultDeclared: true },
    cutoffCategories: ["GOPENS"],
    categoryMappingVerified: true,
  });
  
  assert.equal(expectedMode.predictionMode, "expected_percentile");
  assert.equal(actualMode.predictionMode, "actual_percentile");
  
  console.log("Expected vs actual percentile mode tests passed.");

console.log("Chance classification boundary tests passed.");
// 13. Validate student profile preference fields
const invalidPreferences = validateStudentProfile({
    ...validProfile,
    preferredBranches: "Computer Engineering",
  });
  
  assert.equal(invalidPreferences.valid, false);
  assert.ok(
    invalidPreferences.errors.some((error) =>
      error.includes("Preferred branches")
    )
  );
  
  const invalidReservations = validateStudentProfile({
    ...validProfile,
    specialReservations: "TFWS",
  });
  
  assert.equal(invalidReservations.valid, false);
  assert.ok(
    invalidReservations.errors.some((error) =>
      error.includes("Special reservations")
    )
  );
  
  console.log("Student preference validation tests passed.");