
const masterDataset = require("../data/admissions/2026-27/master-colleges.json");

const {
  validateStudentProfile,
} = require("../eligibility/eligibilityEngine");

const {
  generatePredictions,
} = require("../prediction/predictionEngine");

const {
  createGroqCompletion,
} = require("./groqClient");

const MAX_PREDICTIONS_FOR_AI = 20;

function validatePreferences(profile = {}) {
  const errors = [];

  if (
    profile.budgetMax !== undefined &&
    (
      typeof profile.budgetMax !== "number" ||
      !Number.isFinite(profile.budgetMax) ||
      profile.budgetMax <= 0
    )
  ) {
    errors.push("budgetMax must be a positive number in INR.");
  }

  if (
    profile.preferredCity !== undefined &&
    (
      typeof profile.preferredCity !== "string" ||
      !profile.preferredCity.trim()
    )
  ) {
    errors.push("preferredCity must be a non-empty string.");
  }

  return errors;
}

function buildPersonalizationPrompt(profile, predictionResult) {
  const predictions = predictionResult.predictions
    .slice(0, MAX_PREDICTIONS_FOR_AI)
    .map((item) => ({
      collegeName: item.collegeName,
      collegeCode: item.collegeCode,
      branch: item.branch,
      courseCode: item.courseCode,
      historicalCutoffPercentile: item.historicalCutoffPercentile,
      studentPercentile: item.studentPercentile,
      percentileDifference: item.percentileDifference,
      chance: item.chance,
      confidence: item.confidence,
      branchPreferred: item.branchPreferred,
      homeUniversityMatch: item.homeUniversityMatch,
    }));

  return [
    {
      role: "system",
      content: `
You are ClgWise Personalized College Suggestions AI.

Your job is to explain deterministic college matching results
for Maharashtra MHT-CET engineering admissions.

STRICT RULES:
- Use only the supplied student profile and prediction results.
- Never invent colleges, courses, cutoff percentiles, fees,
  placements, locations, or admission rules.
- Do not modify or recalculate chance classifications.
- Do not claim admission is guaranteed.
- All cutoff figures refer to historical 2026-27 CAP Round I data.
- Predictions target 2027-28 but are only historical comparisons.
- Explain that confidence measures data completeness, not admission probability.
- Gender and special reservation seat rules have not been applied.
- Budget and city preferences are not verified against the current dataset.
  Never claim that a college fits either preference.
- Explain why the returned colleges appear relevant using the supplied fields.
- If results are limited, clearly say so.
- Reply in the same language as the student's request.
- Support English, Marathi, and natural Marathi-English.
- Keep the response practical and concise.

Return guidance as readable text. Do not create new numerical predictions.
      `.trim(),
    },
    {
      role: "user",
      content: JSON.stringify({
        studentProfile: profile,
        predictionSummary: predictionResult.summary,
        dataQuality: predictionResult.dataQuality,
        predictions,
        disclaimer: predictionResult.disclaimer,
      }),
    },
  ];
}

async function getPersonalizedSuggestions({
  studentProfile,
  dataset = masterDataset,
  predictionGenerator = generatePredictions,
  completionGenerator = createGroqCompletion,
}) {
  if (
    !studentProfile ||
    typeof studentProfile !== "object" ||
    Array.isArray(studentProfile)
  ) {
    return {
      status: "invalid_profile",
      errors: ["Student profile must be an object."],
    };
  }

  const profileErrors = [
    ...validateStudentProfile(studentProfile).errors,
    ...validatePreferences(studentProfile),
  ];

  if (profileErrors.length > 0) {
    return {
      status: "invalid_profile",
      errors: profileErrors,
    };
  }

  const predictionResult = predictionGenerator({
    colleges: dataset.institutes,
    studentProfile,
  });

  if (predictionResult.status !== "completed") {
    return {
      status: predictionResult.status,
      message:
        predictionResult.message ||
        "Verified college matching could not be completed.",
      predictions: [],
      categoryResolution: predictionResult.categoryResolution || null,
      eligibility: predictionResult.eligibility || null,
      disclaimer:
        "ClgWise will not generate specific college suggestions without verified cutoff-category mapping.",
    };
  }

  if (!predictionResult.predictions.length) {
    return {
      status: "no_matches",
      message:
        "No matching historical cutoff records were found for this profile.",
      predictions: [],
      summary: predictionResult.summary,
      disclaimer: predictionResult.disclaimer,
    };
  }

  const messages = buildPersonalizationPrompt(
    studentProfile,
    predictionResult
  );

  const completion = await completionGenerator(messages);

  return {
    status: "completed",
    guidance: completion.answer,
    model: completion.model,

    studentProfile: {
      examType: studentProfile.examType,
      percentile:
        studentProfile.isResultDeclared === true
          ? studentProfile.percentile
          : studentProfile.expectedPercentile ??
            studentProfile.percentile,
      predictionMode: predictionResult.predictionMode,
      category: studentProfile.category,
      candidatureType: studentProfile.candidatureType,
      preferredBranches: studentProfile.preferredBranches || [],
      homeUniversity: studentProfile.homeUniversity || null,
      budgetMax: studentProfile.budgetMax ?? null,
      preferredCity: studentProfile.preferredCity || null,
    },

    summary: predictionResult.summary,
    predictions: predictionResult.predictions,

    preferenceCoverage: {
      percentileMatching: true,
      categoryMatching: true,
      branchPreferenceApplied: true,
      homeUniversityUsedForRanking: Boolean(
        studentProfile.homeUniversity
      ),
      budgetApplied: false,
      cityApplied: false,
      reason:
        "Verified fee and location fields are not currently available in the admissions dataset.",
    },

    dataQuality: predictionResult.dataQuality,
    categoryResolution: predictionResult.categoryResolution,
    eligibility: predictionResult.eligibility,

    disclaimer: predictionResult.disclaimer,
  };
}

module.exports = {
  validatePreferences,
  buildPersonalizationPrompt,
  getPersonalizedSuggestions,
};
