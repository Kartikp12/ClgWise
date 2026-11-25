
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

const MIN_CHOICES = 1;
const MAX_CHOICES = 100;
const MAX_AI_CHOICES = 100;
const MAX_AI_ALTERNATIVES = 15;

const DISCLAIMER =
  "This guidance uses historical 2026-27 CAP Round I cutoff data. " +
  "Official 2027-28 category mapping and admission rules are pending. " +
  "Historical classifications are not admission probabilities or guarantees. " +
  "Gender and special-reservation seat rules are not applied.";

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function validateChoiceFillingRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ["Request body must be an object."],
    };
  }

  const profileValidation = validateStudentProfile(
    payload.studentProfile
  );

  if (!profileValidation.valid) {
    return {
      valid: false,
      errors: profileValidation.errors,
    };
  }

  if (!Array.isArray(payload.choices)) {
    return {
      valid: false,
      errors: ["Choices must be an array."],
    };
  }

  if (
    payload.choices.length < MIN_CHOICES ||
    payload.choices.length > MAX_CHOICES
  ) {
    return {
      valid: false,
      errors: [
        `Choices must contain between ${MIN_CHOICES} and ${MAX_CHOICES} entries.`,
      ],
    };
  }

  const seen = new Set();
  const errors = [];

  const choices = payload.choices.map((choice, index) => {
    if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
      errors.push(`Choice ${index + 1} must be an object.`);
      return null;
    }

    const instituteCode = normalizeCode(choice.instituteCode);
    const courseCode = normalizeCode(choice.courseCode);
    const branch = String(choice.branch ?? "").trim();

    if (!instituteCode) {
      errors.push(`Choice ${index + 1}: instituteCode is required.`);
    }

    if (instituteCode.length > 30 || courseCode.length > 30) {
      errors.push(`Choice ${index + 1}: institute or course code is too long.`);
    }

    if (!courseCode && !branch) {
      errors.push(
        `Choice ${index + 1}: courseCode or branch is required.`
      );
    }

    if (branch.length > 150) {
      errors.push(`Choice ${index + 1}: branch is too long.`);
    }

    const identity =
      `${instituteCode}:${courseCode || branch.toLowerCase()}`;

    if (seen.has(identity)) {
      errors.push(`Choice ${index + 1}: duplicate choice.`);
    }

    seen.add(identity);

    return {
      instituteCode,
      ...(courseCode ? { courseCode } : {}),
      ...(branch ? { branch } : {}),
      originalPosition: index + 1,
    };
  });

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    studentProfile: payload.studentProfile,
    choices,
  };
}

function resolveChoicesAgainstDataset(choices, dataset) {
  const institutes = Array.isArray(dataset?.institutes)
    ? dataset.institutes
    : [];

  return choices.map((choice) => {
    const institute = institutes.find(
      (item) =>
        normalizeCode(item.instituteCode) === choice.instituteCode
    );

    if (!institute) {
      return {
        ...choice,
        status: "institute_not_found",
        instituteName: null,
        courseName: null,
        message: "Institute code was not found in the master dataset.",
      };
    }

    const courses = Array.isArray(institute.courses)
      ? institute.courses
      : [];

    const course = courses.find((item) => {
      if (choice.courseCode) {
        return normalizeCode(item.courseCode) === choice.courseCode;
      }

      return (
        String(item.branch ?? "").trim().toLowerCase() ===
        choice.branch.toLowerCase()
      );
    });

    if (!course) {
      return {
        ...choice,
        status: "course_not_found",
        instituteName: institute.instituteName || null,
        courseName: null,
        message: "Course or branch was not found for this institute.",
      };
    }

    return {
      ...choice,
      status: "verified_in_dataset",
      instituteName: institute.instituteName || null,
      courseName: course.branch || course.courseName || null,
      courseCode: normalizeCode(course.courseCode),
    };
  });
}

function buildStructuralReview(resolvedChoices) {
  const verifiedChoices = resolvedChoices.filter(
    (choice) => choice.status === "verified_in_dataset"
  );

  const invalidChoices = resolvedChoices.filter(
    (choice) => choice.status !== "verified_in_dataset"
  );

  return {
    totalChoices: resolvedChoices.length,
    verifiedChoices: verifiedChoices.length,
    invalidChoices: invalidChoices.length,
    choices: resolvedChoices,
    preferenceOrderPreserved: true,
    observations: [
      "The submitted preference order has been preserved.",
      "College and course details are checked against the available master dataset.",
      "Cutoff-based risk classification requires verified category mapping.",
    ],
  };
}

function buildPendingResult(
  resolvedChoices,
  studentProfile,
  predictionResult
) {
  return {
    status: "category_mapping_pending",
    studentProfile: {
      examType: studentProfile.examType,
      percentile:
        studentProfile.isResultDeclared === true
          ? studentProfile.percentile
          : studentProfile.expectedPercentile ?? studentProfile.percentile,
      category: studentProfile.category,
    },
    structuralReview: buildStructuralReview(resolvedChoices),
    categoryResolution: predictionResult?.categoryResolution || null,
    predictionStatus: "not_generated",
    aiGuidanceStatus: "not_generated",
    message:
      "The choice list was structurally reviewed. Personalized cutoff-based CAP guidance is unavailable until official category mapping is verified.",
    disclaimer: DISCLAIMER,
  };
}

function buildChoiceAnalysis(resolvedChoices, predictions) {
  const predictionMap = new Map();

  predictions.forEach((prediction) => {
    const key = [
      normalizeCode(prediction.collegeCode),
      normalizeCode(prediction.courseCode),
    ].join(":");

    predictionMap.set(key, prediction);
  });

  return resolvedChoices.map((choice) => {
    const key = [
      choice.instituteCode,
      choice.courseCode,
    ].join(":");

    const prediction = predictionMap.get(key);

    if (!prediction) {
      return {
        ...choice,
        analysisStatus: "historical_cutoff_not_found",
        chance: "insufficient_data",
        explanation:
          "No matching historical cutoff record was returned for this choice.",
      };
    }

    return {
      ...choice,
      analysisStatus: "analyzed",
      historicalCutoffPercentile:
        prediction.historicalCutoffPercentile,
      studentPercentile: prediction.studentPercentile,
      percentileDifference: prediction.percentileDifference,
      chance: prediction.chance,
      chanceExplanation: prediction.chanceExplanation,
      recommendationExplanation: prediction.recommendationExplanation,
      confidence: prediction.confidence,
      referenceAcademicYear: prediction.academicYear || "2026-27",
      admissionRound: prediction.admissionRound || "CAP Round I",
    };
  });
}

function buildAlternativeChoices(resolvedChoices, predictions) {
  const selectedKeys = new Set(
    resolvedChoices.map(
      (choice) =>
        `${choice.instituteCode}:${choice.courseCode}`
    )
  );

  return predictions
    .filter((prediction) => {
      const key = [
        normalizeCode(prediction.collegeCode),
        normalizeCode(prediction.courseCode),
      ].join(":");

      return !selectedKeys.has(key);
    })
    .slice(0, MAX_AI_ALTERNATIVES)
    .map((prediction) => ({
      instituteCode: normalizeCode(prediction.collegeCode),
      instituteName: prediction.collegeName,
      courseCode: normalizeCode(prediction.courseCode),
      branch: prediction.branch,
      historicalCutoffPercentile:
        prediction.historicalCutoffPercentile,
      percentileDifference: prediction.percentileDifference,
      chance: prediction.chance,
      confidence: prediction.confidence,
      reason: prediction.recommendationExplanation,
    }));
}

function buildChoiceGuidancePrompt({
  studentProfile,
  choiceAnalysis,
  alternatives,
  predictionResult,
}) {
  const suppliedChoices = choiceAnalysis
    .slice(0, MAX_AI_CHOICES)
    .map((choice) => ({
      originalPosition: choice.originalPosition,
      instituteCode: choice.instituteCode,
      instituteName: choice.instituteName,
      courseCode: choice.courseCode,
      branch: choice.courseName,
      analysisStatus: choice.analysisStatus,
      historicalCutoffPercentile:
        choice.historicalCutoffPercentile ?? null,
      studentPercentile: choice.studentPercentile ?? null,
      percentileDifference: choice.percentileDifference ?? null,
      chance: choice.chance,
      chanceExplanation: choice.chanceExplanation || null,
      confidence: choice.confidence ?? null,
    }));

  return [
    {
      role: "system",
      content: `
You are ClgWise AI CAP Choice Filling Guidance Assistant.

Your task is to explain a student's ordered Maharashtra MHT-CET
engineering CAP preference list using verified deterministic data.

STRICT DATA RULES:
- Use only the supplied student profile, choice analysis,
  alternative choices, and prediction summary.
- Never invent colleges, institute codes, course codes,
  cutoffs, categories, seat types, fees, locations or admission rules.
- Never calculate or change cutoff values or chance classifications.
- Safe, moderate and ambitious are historical comparison labels,
  not admission probabilities or guarantees.
- Historical cutoff reference is 2026-27 CAP Round I.
- Target admission year is 2027-28.
- Official 2027-28 category mapping must be verified before
  this guidance is generated.
- Confidence represents data completeness, not admission probability.
- Gender and special-reservation seat rules are not applied.
- A missing historical cutoff is not proof of ineligibility.

PREFERENCE ORDER RULES:
- The student's original preference order is authoritative.
- NEVER reorder, rank, sort, or automatically rearrange choices.
- An ambitious choice may remain first if the student prefers it.
- Explain admission risk separately from personal preference.
- Never describe a lower-risk college as automatically a better preference.
- Suggestions are optional alternatives, not replacements.

ANALYSIS:
1. Explain each selected choice using its original position.
2. Explain historical cutoff differences and supplied chance labels.
3. Identify choices with missing historical cutoff data.
4. Explain the overall balance of the supplied list.
5. Mention additional alternatives only from the supplied alternatives.
6. Explain important limitations before the student submits the list.
7. Never claim the list guarantees admission.

LANGUAGE:
- Reply in the same language as the student's request.
- Support English, Marathi and natural Marathi-English.
- Keep guidance practical, clear and concise.

Return readable structured guidance. Do not create new numerical predictions.
      `.trim(),
    },
    {
      role: "user",
      content: JSON.stringify({
        studentProfile: {
          examType: studentProfile.examType,
          percentile:
            studentProfile.isResultDeclared === true
              ? studentProfile.percentile
              : studentProfile.expectedPercentile ??
                studentProfile.percentile,
          category: studentProfile.category,
          candidatureType: studentProfile.candidatureType,
          preferredBranches: studentProfile.preferredBranches || [],
          homeUniversity: studentProfile.homeUniversity || null,
        },
        choiceAnalysis: suppliedChoices,
        alternativeChoices: alternatives,
        predictionSummary: predictionResult.summary,
        dataQuality: predictionResult.dataQuality,
        disclaimer: predictionResult.disclaimer,
      }),
    },
  ];
}

async function analyzeCapChoices(payload, dependencies = {}) {
  const {
    dataset = masterDataset,
    predictionGenerator = generatePredictions,
    completionGenerator = createGroqCompletion,
  } = dependencies;

  const validation = validateChoiceFillingRequest(payload);

  if (!validation.valid) {
    return {
      status: "invalid_request",
      errors: validation.errors,
    };
  }

  const resolvedChoices = resolveChoicesAgainstDataset(
    validation.choices,
    dataset
  );

  const structuralReview = buildStructuralReview(resolvedChoices);

  if (structuralReview.invalidChoices > 0) {
    return {
      status: "choice_validation_failed",
      structuralReview,
      predictionStatus: "not_generated",
      aiGuidanceStatus: "not_generated",
      message:
        "Some choices could not be verified. Correct the institute or course details before continuing.",
      disclaimer: DISCLAIMER,
    };
  }

  const predictionResult = predictionGenerator({
    colleges: dataset.institutes || [],
    studentProfile: validation.studentProfile,
  });

  if (predictionResult?.status !== "completed") {
    return buildPendingResult(
      resolvedChoices,
      validation.studentProfile,
      predictionResult
    );
  }

  if (!Array.isArray(predictionResult.predictions)) {
    return {
      status: "prediction_error",
      structuralReview,
      message: "Prediction engine returned an invalid result.",
      predictionStatus: "failed",
      aiGuidanceStatus: "not_generated",
      disclaimer: DISCLAIMER,
    };
  }

  if (predictionResult.predictions.length === 0) {
    return {
      status: "no_matches",
      structuralReview,
      predictionStatus: "completed",
      aiGuidanceStatus: "not_generated",
      choiceAnalysis: resolvedChoices.map((choice) => ({
        ...choice,
        analysisStatus: "historical_cutoff_not_found",
        chance: "insufficient_data",
      })),
      alternativeChoices: [],
      message:
        "No matching historical cutoff records were found for this student profile.",
      disclaimer: predictionResult.disclaimer || DISCLAIMER,
    };
  }

  const choiceAnalysis = buildChoiceAnalysis(
    resolvedChoices,
    predictionResult.predictions
  );

  const alternativeChoices = buildAlternativeChoices(
    resolvedChoices,
    predictionResult.predictions
  );

  const messages = buildChoiceGuidancePrompt({
    studentProfile: validation.studentProfile,
    choiceAnalysis,
    alternatives: alternativeChoices,
    predictionResult,
  });

  const completion = await completionGenerator(messages);

  return {
    status: "completed",
    studentProfile: {
      examType: validation.studentProfile.examType,
      percentile:
        validation.studentProfile.isResultDeclared === true
          ? validation.studentProfile.percentile
          : validation.studentProfile.expectedPercentile ??
            validation.studentProfile.percentile,
      category: validation.studentProfile.category,
      candidatureType: validation.studentProfile.candidatureType,
    },
    structuralReview,
    choiceAnalysis,
    alternativeChoices,
    preferenceOrderPreserved: true,
    summary: predictionResult.summary,
    guidance: completion.answer,
    model: completion.model,
    predictionStatus: "completed",
    aiGuidanceStatus: "completed",
    categoryResolution: predictionResult.categoryResolution,
    dataQuality: predictionResult.dataQuality,
    eligibility: predictionResult.eligibility,
    disclaimer: predictionResult.disclaimer || DISCLAIMER,
  };
}

module.exports = {
  analyzeCapChoices,
  validateChoiceFillingRequest,
  resolveChoicesAgainstDataset,
  buildStructuralReview,
  buildChoiceAnalysis,
  buildAlternativeChoices,
  buildChoiceGuidancePrompt,
};
