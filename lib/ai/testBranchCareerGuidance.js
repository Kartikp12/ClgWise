
const assert = require("assert");

const {
  validateBranchCareerRequest,
  buildBranchCareerPrompt,
  getBranchCareerGuidance,
} = require("./branchCareerGuidance");

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

  test("Accepts a valid explore request", () => {
    const result = validateBranchCareerRequest({
      action: "explore",
      branches: ["Computer Science Engineering"],
    });

    assert.strictEqual(result.valid, true);
  });

  test("Accepts a valid compare request", () => {
    const result = validateBranchCareerRequest({
      action: "compare",
      branches: ["Computer Engineering", "Mechanical Engineering"],
    });

    assert.strictEqual(result.valid, true);
  });

  test("Accepts a valid career request", () => {
    const result = validateBranchCareerRequest({
      action: "career",
      branches: ["Artificial Intelligence and Data Science"],
    });

    assert.strictEqual(result.valid, true);
  });

  test("Accepts a valid personalized request", () => {
    const result = validateBranchCareerRequest({
      action: "personalized",
      interests: "AI, technology and problem solving",
      strengths: "Logical thinking and mathematics",
    });

    assert.strictEqual(result.valid, true);
  });

  test("Rejects unsupported actions", () => {
    const result = validateBranchCareerRequest({
      action: "recommend",
      branches: ["Computer Engineering"],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects explore requests with multiple branches", () => {
    const result = validateBranchCareerRequest({
      action: "explore",
      branches: ["Computer Engineering", "Mechanical Engineering"],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects compare requests with fewer than two branches", () => {
    const result = validateBranchCareerRequest({
      action: "compare",
      branches: ["Computer Engineering"],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects compare requests with more than four branches", () => {
    const result = validateBranchCareerRequest({
      action: "compare",
      branches: [
        "Computer Engineering",
        "Mechanical Engineering",
        "Civil Engineering",
        "Electrical Engineering",
        "Chemical Engineering",
      ],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects duplicate branch names", () => {
    const result = validateBranchCareerRequest({
      action: "compare",
      branches: ["Computer Engineering", " computer engineering "],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects empty branch names", () => {
    const result = validateBranchCareerRequest({
      action: "explore",
      branches: [""],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects branch names longer than 150 characters", () => {
    const result = validateBranchCareerRequest({
      action: "explore",
      branches: ["A".repeat(151)],
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects personalized requests without interests", () => {
    const result = validateBranchCareerRequest({
      action: "personalized",
      strengths: "Logical thinking",
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects personalized requests without strengths", () => {
    const result = validateBranchCareerRequest({
      action: "personalized",
      interests: "Technology and AI",
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects excessively long student inputs", () => {
    const result = validateBranchCareerRequest({
      action: "personalized",
      interests: "A".repeat(1001),
      strengths: "Logical thinking",
    });

    assert.strictEqual(result.valid, false);
  });

  test("Rejects invalid request body", () => {
    const result = validateBranchCareerRequest(null);

    assert.strictEqual(result.valid, false);
  });

  test("Rejects invalid question types", () => {
    const result = validateBranchCareerRequest({
      action: "explore",
      branches: ["Computer Engineering"],
      question: { text: "Explain this branch" },
    });

    assert.strictEqual(result.valid, false);
  });

  test("Includes dynamically supplied branch names in the prompt", () => {
    const messages = buildBranchCareerPrompt({
      action: "explore",
      branches: ["Robotics and Automation Engineering"],
    });

    assert.ok(
      messages[1].content.includes("Robotics and Automation Engineering")
    );
  });

  test("Includes comparison instructions in the prompt", () => {
    const messages = buildBranchCareerPrompt({
      action: "compare",
      branches: ["Computer Engineering", "Mechanical Engineering"],
    });

    assert.ok(
      messages[0].content.includes("Compare all requested engineering branches")
    );
  });

  test("Includes student interests and strengths in personalized prompt", () => {
    const messages = buildBranchCareerPrompt({
      action: "personalized",
      interests: "Artificial intelligence",
      strengths: "Logical thinking",
    });

    assert.ok(messages[1].content.includes("Artificial intelligence"));
    assert.ok(messages[1].content.includes("Logical thinking"));
  });

  test("Does not contain a hardcoded branch knowledge catalogue", () => {
    const messages = buildBranchCareerPrompt({
      action: "explore",
      branches: ["Quantum Engineering"],
    });

    assert.ok(
      messages[0].content.includes("Generate explanations dynamically")
    );

    assert.ok(
      messages[0].content.includes("predefined ClgWise branch knowledge base")
    );

    assert.ok(
      messages[1].content.includes("Quantum Engineering")
    );
  });

  await testAsync("Calls the completion generator for a valid request", async () => {
    let called = false;

    const result = await getBranchCareerGuidance({
      request: {
        action: "explore",
        branches: ["Computer Engineering"],
      },
      completionGenerator: async (messages) => {
        called = true;

        assert.strictEqual(messages.length, 2);

        return {
          answer: "Computer Engineering combines software and hardware concepts.",
          model: "test-model",
        };
      },
    });

    assert.strictEqual(called, true);
    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.action, "explore");
    assert.strictEqual(result.model, "test-model");
    assert.ok(result.guidance.includes("Computer Engineering"));
    assert.ok(result.disclaimer);
  });

  await testAsync("Does not call AI for an invalid request", async () => {
    let called = false;

    const result = await getBranchCareerGuidance({
      request: {
        action: "explore",
        branches: [],
      },
      completionGenerator: async () => {
        called = true;
        return { answer: "Unexpected", model: "test-model" };
      },
    });

    assert.strictEqual(called, false);
    assert.strictEqual(result.status, "invalid_request");
    assert.ok(result.errors.length > 0);
  });

  await testAsync("Propagates AI completion errors", async () => {
    await assert.rejects(
      () =>
        getBranchCareerGuidance({
          request: {
            action: "explore",
            branches: ["Computer Engineering"],
          },
          completionGenerator: async () => {
            throw new Error("Groq API unavailable");
          },
        }),
      /Groq API unavailable/
    );
  });

  console.log(`\n${passed} tests passed successfully.`);
}

runTests().catch((error) => {
  console.error("\nTEST FAILURE:", error);
  process.exitCode = 1;
});
