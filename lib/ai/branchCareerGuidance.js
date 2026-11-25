
const { createGroqCompletion } = require("./groqClient");

const VALID_ACTIONS = [
  "explore",
  "compare",
  "career",
  "personalized",
];

const MAX_BRANCHES = 4;
const MAX_TEXT_LENGTH = 1000;

function validateBranchCareerRequest(request) {
  const errors = [];

  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    return {
      valid: false,
      errors: ["Request body must be an object."],
    };
  }

  const { action, branches, interests, strengths, question } = request;

  if (!VALID_ACTIONS.includes(action)) {
    errors.push(
      `action must be one of: ${VALID_ACTIONS.join(", ")}.`
    );
  }

  if (branches !== undefined) {
    if (!Array.isArray(branches)) {
      errors.push("branches must be an array.");
    } else {
      if (branches.length > MAX_BRANCHES) {
        errors.push(`You can provide a maximum of ${MAX_BRANCHES} branches.`);
      }

      if (
        !branches.every(
          (branch) =>
            typeof branch === "string" &&
            branch.trim().length > 0 &&
            branch.trim().length <= 150
        )
      ) {
        errors.push(
          "Every branch must be a non-empty string of at most 150 characters."
        );
      }

      const normalizedBranches = branches.map((branch) =>
        branch.trim().toLowerCase()
      );

      if (
        new Set(normalizedBranches).size !==
        normalizedBranches.length
      ) {
        errors.push("Duplicate branches are not allowed.");
      }
    }
  }

  if (
    ["explore", "career"].includes(action) &&
    (!Array.isArray(branches) || branches.length !== 1)
  ) {
    errors.push(
      `${action} action requires exactly one branch.`
    );
  }

  if (
    action === "compare" &&
    (!Array.isArray(branches) ||
      branches.length < 2 ||
      branches.length > MAX_BRANCHES)
  ) {
    errors.push(
      `compare action requires between 2 and ${MAX_BRANCHES} branches.`
    );
  }

  if (action === "personalized") {
    if (
      typeof interests !== "string" ||
      !interests.trim() ||
      interests.length > MAX_TEXT_LENGTH
    ) {
      errors.push(
        "personalized action requires interests as a non-empty string of at most 1000 characters."
      );
    }

    if (
      typeof strengths !== "string" ||
      !strengths.trim() ||
      strengths.length > MAX_TEXT_LENGTH
    ) {
      errors.push(
        "personalized action requires strengths as a non-empty string of at most 1000 characters."
      );
    }
  }

  if (
    question !== undefined &&
    (
      typeof question !== "string" ||
      question.trim().length > MAX_TEXT_LENGTH
    )
  ) {
    errors.push(
      "question must be a string of at most 1000 characters."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildBranchCareerPrompt(request) {
  const { action, branches = [], interests, strengths, question } = request;

  const actionInstructions = {
    explore: `
Explain the requested engineering branch in detail.

Cover:
1. What this branch is about.
2. Important subjects and concepts students generally study.
3. Technical and practical skills involved.
4. Types of projects students may work on.
5. Possible career paths and job roles.
6. Who may find this branch interesting.
7. Challenges and learning expectations.
`,

    compare: `
Compare all requested engineering branches objectively.

Cover:
1. Core focus of each branch.
2. Differences in commonly studied subjects.
3. Technical skills required.
4. Types of projects and practical work.
5. Potential career paths and job roles.
6. Similarities and important differences.
7. What kind of student may prefer each branch.

Use a clear comparison table where useful.
Do not declare one branch universally better.
`,

    career: `
Explain possible career paths after studying the requested branch.

Cover:
1. Relevant technical domains.
2. Possible entry-level job roles.
3. Skills and tools students may need to learn.
4. Example project areas for building experience.
5. Higher education and specialization possibilities.
6. Different career directions within the branch.
7. Practical steps a student can take to prepare.
`,

    personalized: `
Provide personalized engineering branch and career guidance
based on the student's stated interests and strengths.

Cover:
1. Understand the student's interests and strengths.
2. Identify engineering fields that may align with them.
3. Explain why each suggested field may be relevant.
4. Discuss skills the student may need to develop.
5. Suggest practical projects or learning activities.
6. Explain trade-offs and areas they should explore further.
7. Give practical next steps before making a decision.

If the student supplies preferred branches, consider them
but do not automatically recommend them without reasoning.

Do not present the guidance as a professional aptitude test
or a definitive career assessment.
`,
  };

  const systemPrompt = `
You are ClgWise AI Branch and Career Guidance Assistant.

You help students understand engineering disciplines,
compare branches, explore career paths, and make informed
education decisions.

DYNAMIC KNOWLEDGE RULES:
- Generate explanations dynamically using your general knowledge.
- Do not depend on a predefined ClgWise branch knowledge base.
- Do not claim that ClgWise has verified or stored information
  about a branch unless supplied in the request.
- Support recognized and emerging engineering disciplines.
- If a branch name is ambiguous or unfamiliar, explain the
  ambiguity and ask for clarification instead of inventing details.
- Distinguish established facts from general guidance and
  possible future opportunities.

STRICT ACCURACY RULES:
- Never invent salary figures, placement percentages,
  college placement statistics, hiring rates, or job guarantees.
- Do not claim a particular career path guarantees employment.
- Do not make unsupported claims about current job-market demand.
- Do not invent university syllabi or claim every college
  teaches identical subjects.
- Explain that curricula vary by institution and university.
- Describe job roles as possible career options, not guaranteed outcomes.
- Do not rank branches by prestige or claim one branch is
  universally superior.
- Do not make assumptions about the student's abilities,
  personality, background, or financial situation.
- If information is uncertain, clearly state the uncertainty.

PERSONALIZATION:
- Base personalized guidance only on the interests and strengths
  explicitly supplied by the student.
- Explain the reasoning behind suggestions.
- Encourage students to explore subjects and projects before
  making major education decisions.

LANGUAGE:
- Reply in the same language used by the student.
- Support English, Marathi, and natural Marathi-English.
- Explain technical terminology in student-friendly language.

RESPONSE STYLE:
- Use clear headings and structured explanations.
- Use comparison tables when appropriate.
- Be practical, balanced, and educational.
- Avoid unnecessarily long or repetitive explanations.

${actionInstructions[action]}

If the student provides an additional question, address it
within the scope of the selected action.
  `.trim();

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: JSON.stringify({
        action,
        branches,
        interests: interests || null,
        strengths: strengths || null,
        question: question?.trim() || null,
      }),
    },
  ];
}

async function getBranchCareerGuidance({
  request,
  completionGenerator = createGroqCompletion,
}) {
  const validation = validateBranchCareerRequest(request);

  if (!validation.valid) {
    return {
      status: "invalid_request",
      errors: validation.errors,
    };
  }

  const messages = buildBranchCareerPrompt(request);

  const completion = await completionGenerator(messages);

  return {
    status: "completed",
    action: request.action,
    branches: request.branches || [],
    guidance: completion.answer,
    model: completion.model,
    disclaimer:
      "This AI-generated guidance is for educational exploration only. Career paths, skills and opportunities vary by individual, institution and changing industry conditions. It is not a placement or employment guarantee.",
  };
}

module.exports = {
  validateBranchCareerRequest,
  buildBranchCareerPrompt,
  getBranchCareerGuidance,
};
