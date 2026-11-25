
const assert = require("assert");

const {
  analyzeCapChoices,
  validateChoiceFillingRequest,
  resolveChoicesAgainstDataset,
  buildStructuralReview,
  buildChoiceAnalysis,
  buildAlternativeChoices,
  buildChoiceGuidancePrompt,
} = require("./capChoiceGuidance");

const testDataset = {
  institutes: [
    {
      instituteCode: "1001",
      instituteName: "Test Engineering College",
      courses: [
        {
          courseCode: "100119110",
          branch: "Computer Engineering",
        },
        {
          courseCode: "100119120",
          branch: "Information Technology",
        },
      ],
    },
    {
      instituteCode: "1002",
      instituteName: "Another Engineering College",
      courses: [
        {
          courseCode: "100219110",
          branch: "Mechanical Engineering",
        },
      ],
    },
  ],
};

const validProfile = {
  examType: "MHT-CET",
  isResultDeclared: true,
  percentile: 95,
  category: "OPEN",
  candidatureType: "Maharashtra State",
};

const validPayload = {
  studentProfile: validProfile,
  choices: [
    { instituteCode: "1001", courseCode: "100119110" },
    { instituteCode: "1002", courseCode: "100219110" },
  ],
};

const mockPredictions = [
  {
    collegeCode: "1001",
    collegeName: "Test Engineering College",
    courseCode: "100119110",
    branch: "Computer Engineering",
    historicalCutoffPercentile: 93,
    studentPercentile: 95,
    percentileDifference: 2,
    chance: "safe",
    chanceExplanation: "Historical comparison only.",
    recommendationExplanation: "Two points above historical cutoff.",
    confidence: 55,
    academicYear: "2026-27",
    admissionRound: "CAP Round I",
  },
  {
    collegeCode: "1002",
    collegeName: "Another Engineering College",
    courseCode: "100219110",
    branch: "Mechanical Engineering",
    historicalCutoffPercentile: 96,
    studentPercentile: 95,
    percentileDifference: -1,
    chance: "moderate",
    chanceExplanation: "Within two points of historical cutoff.",
    recommendationExplanation: "One point below historical cutoff.",
    confidence: 55,
    academicYear: "2026-27",
    admissionRound: "CAP Round I",
  },
  {
    collegeCode: "1001",
    collegeName: "Test Engineering College",
    courseCode: "100119120",
    branch: "Information Technology",
    historicalCutoffPercentile: 97,
    studentPercentile: 95,
    percentileDifference: -2,
    chance: "moderate",
    chanceExplanation: "Within two points of historical cutoff.",
    recommendationExplanation: "Two points below historical cutoff.",
    confidence: 55,
    academicYear: "2026-27",
    admissionRound: "CAP Round I",
  },
];

const completedPredictionResult = {
  status: "completed",
  predictions: mockPredictions,
  summary: {
    total: 3,
    safe: 1,
    moderate: 2,
    ambitious: 0,
  },
  categoryResolution: {
    status: "resolved",
    verified: true,
  },
  dataQuality: {
    matchingCoverage: 100,
  },
  eligibility: {
    status: "rules_pending",
    eligible: null,
  },
  disclaimer: "Historical cutoff comparison only.",
};

async function runTests() {
  let passed = 0;

  function test(name, callback) {
    callback();
    passed++;
    console.log(`PASS: ${name}`);
  }

  async function testAsync(name, callback) {
    await callback();
    passed++;
    console.log(`PASS: ${name}`);
  }

  test("Accepts a valid choice-filling request", () => {
    const result = validateChoiceFillingRequest(validPayload);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.choices.length, 2);
  });

  test("Rejects an invalid request body", () => {
    assert.strictEqual(
      validateChoiceFillingRequest(null).valid,
      false
    );
  });

  test("Rejects an invalid student profile", () => {
    const result = validateChoiceFillingRequest({
      ...validPayload,
      studentProfile: { examType: "INVALID" },
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects an empty choice list", () => {
    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices: [],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects more than 100 choices", () => {
    const choices = Array.from({ length: 101 }, (_, index) => ({
      instituteCode: `INST${index}`,
      courseCode: `COURSE${index}`,
    }));

    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices,
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects duplicate choices", () => {
    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices: [
        { instituteCode: "1001", courseCode: "100119110" },
        { instituteCode: " 1001 ", courseCode: "100119110" },
      ],
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("duplicate")));
  });

  test("Rejects missing institute code", () => {
    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices: [{ courseCode: "100119110" }],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects missing course code and branch", () => {
    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices: [{ instituteCode: "1001" }],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects excessively long institute codes", () => {
    const result = validateChoiceFillingRequest({
      studentProfile: validProfile,
      choices: [
        {
          instituteCode: "A".repeat(31),
          courseCode: "100119110",
        },
      ],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Resolves a real institute and course from the test dataset", () => {
    const result = resolveChoicesAgainstDataset(
      [
        {
          instituteCode: "1001",
          courseCode: "100119110",
          originalPosition: 1,
        },
      ],
      testDataset
    );

    assert.strictEqual(result[0].status, "verified_in_dataset");
    assert.strictEqual(
      result[0].instituteName,
      "Test Engineering College"
    );
    assert.strictEqual(
      result[0].courseName,
      "Computer Engineering"
    );
  });

  test("Resolves a course using its branch name", () => {
    const result = resolveChoicesAgainstDataset(
      [
        {
          instituteCode: "1001",
          branch: "computer engineering",
          originalPosition: 1,
        },
      ],
      testDataset
    );

    assert.strictEqual(result[0].status, "verified_in_dataset");
    assert.strictEqual(result[0].courseCode, "100119110");
  });

  test("Identifies an unknown institute", () => {
    const result = resolveChoicesAgainstDataset(
      [
        {
          instituteCode: "9999",
          courseCode: "999999999",
          originalPosition: 1,
        },
      ],
      testDataset
    );

    assert.strictEqual(result[0].status, "institute_not_found");
  });

  test("Identifies an unknown course", () => {
    const result = resolveChoicesAgainstDataset(
      [
        {
          instituteCode: "1001",
          courseCode: "999999999",
          originalPosition: 1,
        },
      ],
      testDataset
    );

    assert.strictEqual(result[0].status, "course_not_found");
  });

  test("Preserves the original preference order", () => {
    const validation = validateChoiceFillingRequest(validPayload);

    const resolved = resolveChoicesAgainstDataset(
      validation.choices,
      testDataset
    );

    assert.deepStrictEqual(
      resolved.map((choice) => choice.instituteCode),
      ["1001", "1002"]
    );

    assert.deepStrictEqual(
      resolved.map((choice) => choice.originalPosition),
      [1, 2]
    );
  });

  test("Builds accurate structural review counts", () => {
    const resolved = resolveChoicesAgainstDataset(
      [
        {
          instituteCode: "1001",
          courseCode: "100119110",
          originalPosition: 1,
        },
        {
          instituteCode: "9999",
          courseCode: "999999999",
          originalPosition: 2,
        },
      ],
      testDataset
    );

    const review = buildStructuralReview(resolved);

    assert.strictEqual(review.totalChoices, 2);
    assert.strictEqual(review.verifiedChoices, 1);
    assert.strictEqual(review.invalidChoices, 1);
    assert.strictEqual(review.preferenceOrderPreserved, true);
  });

  test("Matches deterministic predictions to selected choices", () => {
    const resolved = resolveChoicesAgainstDataset(
      validateChoiceFillingRequest(validPayload).choices,
      testDataset
    );

    const analysis = buildChoiceAnalysis(
      resolved,
      mockPredictions
    );

    assert.strictEqual(analysis[0].chance, "safe");
    assert.strictEqual(analysis[1].chance, "moderate");
    assert.strictEqual(analysis[0].percentileDifference, 2);
  });

  test("Marks choices without historical cutoff as insufficient data", () => {
    const resolved = resolveChoicesAgainstDataset(
      validateChoiceFillingRequest(validPayload).choices,
      testDataset
    );

    const analysis = buildChoiceAnalysis(resolved, []);

    assert.strictEqual(
      analysis[0].analysisStatus,
      "historical_cutoff_not_found"
    );

    assert.strictEqual(analysis[0].chance, "insufficient_data");
  });

  test("Finds additional choices without changing selected order", () => {
    const resolved = resolveChoicesAgainstDataset(
      validateChoiceFillingRequest(validPayload).choices,
      testDataset
    );

    const alternatives = buildAlternativeChoices(
      resolved,
      mockPredictions
    );

    assert.strictEqual(alternatives.length, 1);
    assert.strictEqual(alternatives[0].courseCode, "100119120");
  });

  test("Includes preference preservation rules in the AI prompt", () => {
    const resolved = resolveChoicesAgainstDataset(
      validateChoiceFillingRequest(validPayload).choices,
      testDataset
    );

    const analysis = buildChoiceAnalysis(
      resolved,
      mockPredictions
    );

    const messages = buildChoiceGuidancePrompt({
      studentProfile: validProfile,
      choiceAnalysis: analysis,
      alternatives: [],
      predictionResult: completedPredictionResult,
    });

    assert.ok(messages[0].content.includes("NEVER reorder"));
    assert.ok(messages[0].content.includes("not admission probabilities"));
    assert.ok(messages[1].content.includes("originalPosition"));
  });

  await testAsync(
    "Does not call Groq when category mapping is pending",
    async () => {
      let groqCalled = false;

      const result = await analyzeCapChoices(validPayload, {
        dataset: testDataset,
        predictionGenerator: () => ({
          status: "category_mapping_pending",
          predictions: [],
          categoryResolution: {
            status: "mapping_pending",
          },
        }),
        completionGenerator: async () => {
          groqCalled = true;
          return { answer: "Unexpected", model: "test-model" };
        },
      });

      assert.strictEqual(groqCalled, false);
      assert.strictEqual(result.status, "category_mapping_pending");
      assert.strictEqual(result.aiGuidanceStatus, "not_generated");
    }
  );

  await testAsync(
    "Does not call prediction engine for invalid choices",
    async () => {
      let predictionCalled = false;

      const result = await analyzeCapChoices(
        {
          studentProfile: validProfile,
          choices: [
            {
              instituteCode: "9999",
              courseCode: "999999999",
            },
          ],
        },
        {
          dataset: testDataset,
          predictionGenerator: () => {
            predictionCalled = true;
            return completedPredictionResult;
          },
          completionGenerator: async () => ({
            answer: "Unexpected",
            model: "test-model",
          }),
        }
      );

      assert.strictEqual(predictionCalled, false);
      assert.strictEqual(result.status, "choice_validation_failed");
    }
  );

  await testAsync(
    "Generates AI guidance when verified predictions are available",
    async () => {
      let groqCalled = false;

      const result = await analyzeCapChoices(validPayload, {
        dataset: testDataset,
        predictionGenerator: ({ colleges, studentProfile }) => {
          assert.strictEqual(colleges.length, 2);
          assert.strictEqual(studentProfile.percentile, 95);

          return completedPredictionResult;
        },
        completionGenerator: async (messages) => {
          groqCalled = true;

          assert.strictEqual(messages.length, 2);
          assert.ok(messages[0].content.includes("NEVER reorder"));

          return {
            answer: "Your original choice order has been preserved.",
            model: "test-model",
          };
        },
      });

      assert.strictEqual(groqCalled, true);
      assert.strictEqual(result.status, "completed");
      assert.strictEqual(result.aiGuidanceStatus, "completed");
      assert.strictEqual(result.choiceAnalysis.length, 2);
      assert.strictEqual(result.alternativeChoices.length, 1);
      assert.strictEqual(result.preferenceOrderPreserved, true);
      assert.strictEqual(
        result.choiceAnalysis[0].originalPosition,
        1
      );
    }
  );

  await testAsync(
    "Does not call Groq when predictions return no matches",
    async () => {
      let groqCalled = false;

      const result = await analyzeCapChoices(validPayload, {
        dataset: testDataset,
        predictionGenerator: () => ({
          ...completedPredictionResult,
          predictions: [],
        }),
        completionGenerator: async () => {
          groqCalled = true;
          return { answer: "Unexpected", model: "test-model" };
        },
      });

      assert.strictEqual(groqCalled, false);
      assert.strictEqual(result.status, "no_matches");
      assert.strictEqual(result.aiGuidanceStatus, "not_generated");
    }
  );

  await testAsync(
    "Propagates Groq completion errors",
    async () => {
      await assert.rejects(
        () =>
          analyzeCapChoices(validPayload, {
            dataset: testDataset,
            predictionGenerator: () => completedPredictionResult,
            completionGenerator: async () => {
              const error = new Error("Groq API unavailable");
              error.statusCode = 502;
              throw error;
            },
          }),
        /Groq API unavailable/
      );
    }
  );

  console.log(`\n${passed} tests passed successfully.`);
}

runTests().catch((error) => {
  console.error("\nTEST FAILURE:", error);
  process.exitCode = 1;
});
