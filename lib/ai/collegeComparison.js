
const masterDataset = require("../data/admissions/2026-27/master-colleges.json");
const { createGroqCompletion } = require("./groqClient");

const MIN_COLLEGES = 2;
const MAX_COLLEGES = 4;
const OPEN_CATEGORY = "GOPENS";

function validateInstituteCodes(instituteCodes) {
  if (!Array.isArray(instituteCodes)) {
    return {
      valid: false,
      error: "instituteCodes must be an array.",
    };
  }

  if (
    instituteCodes.length < MIN_COLLEGES ||
    instituteCodes.length > MAX_COLLEGES
  ) {
    return {
      valid: false,
      error: `Compare between ${MIN_COLLEGES} and ${MAX_COLLEGES} colleges.`,
    };
  }

  if (
    !instituteCodes.every(
      (code) =>
        typeof code === "string" &&
        code.trim().length > 0 &&
        code.trim().length <= 30
    )
  ) {
    return {
      valid: false,
      error: "Every institute code must be a non-empty string.",
    };
  }

  const normalizedCodes = instituteCodes.map((code) =>
    code.trim().toUpperCase()
  );

  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    return {
      valid: false,
      error: "Duplicate institute codes are not allowed.",
    };
  }

  return {
    valid: true,
    instituteCodes: normalizedCodes,
  };
}

function normalizeBranchName(branch) {
  return String(branch || "").trim().toLowerCase();
}

function getOpenCutoffs(course) {
  const records = Array.isArray(course.cutoffRecords)
    ? course.cutoffRecords
    : [];

  return records
    .filter((record) => record.category === OPEN_CATEGORY)
    .map((record) => ({
      category: OPEN_CATEGORY,
      meritNumber: record.meritNumber ?? null,
      percentile: record.percentile ?? null,
    }));
}

function buildCollegeOverview(institutes, academicYear) {
  return institutes.map((institute) => ({
    instituteCode: institute.instituteCode,
    instituteName: institute.instituteName,
    academicYear,
    admissionRound: institute.cutoffRound || "CAP Round I",
    cutoffAvailable: institute.cutoffAvailable === true,
    totalBranches: Array.isArray(institute.courses)
      ? institute.courses.length
      : 0,
    branches: (Array.isArray(institute.courses)
      ? institute.courses
      : []
    ).map((course) => ({
      courseCode: course.courseCode || null,
      branch: course.branch || "Unknown branch",
      status: course.status || null,
      homeUniversity: course.homeUniversity || null,
    })),
    dataAvailability: {
      fees: "not_available_in_current_dataset",
      placements: "not_available_in_current_dataset",
      verifiedLocation: "not_available_in_current_dataset",
    },
  }));
}

function buildBranchComparison(institutes) {
  const collegeBranches = institutes.map((institute) =>
    (Array.isArray(institute.courses) ? institute.courses : [])
      .map((course) => course.branch)
      .filter(Boolean)
  );

  const normalizedSets = collegeBranches.map(
    (branches) =>
      new Set(branches.map(normalizeBranchName))
  );

  const allBranches = [
    ...new Map(
      collegeBranches
        .flat()
        .map((branch) => [normalizeBranchName(branch), branch])
    ).values(),
  ];

  const commonBranches = allBranches.filter((branch) =>
    normalizedSets.every((branchSet) =>
      branchSet.has(normalizeBranchName(branch))
    )
  );

  const collegeSpecificBranches = institutes.map(
    (institute, index) => ({
      instituteCode: institute.instituteCode,
      instituteName: institute.instituteName,
      branches: allBranches.filter((branch) => {
        const existsHere = normalizedSets[index].has(
          normalizeBranchName(branch)
        );

        const existsInOthers = normalizedSets.some(
          (branchSet, otherIndex) =>
            otherIndex !== index &&
            branchSet.has(normalizeBranchName(branch))
        );

        return existsHere && !existsInOthers;
      }),
    })
  );

  return {
    commonBranches,
    commonBranchCount: commonBranches.length,
    collegeSpecificBranches,
    colleges: institutes.map((institute, index) => ({
      instituteCode: institute.instituteCode,
      instituteName: institute.instituteName,
      totalBranches: collegeBranches[index].length,
      branches: collegeBranches[index],
    })),
  };
}

function buildOpenCutoffComparison(institutes) {
  const courseMaps = institutes.map((institute) => {
    const map = new Map();

    (Array.isArray(institute.courses) ? institute.courses : []).forEach(
      (course) => {
        if (!course.branch) return;

        const key = normalizeBranchName(course.branch);

        if (!map.has(key)) {
          map.set(key, {
            branch: course.branch,
            cutoffs: [],
          });
        }

        map.get(key).cutoffs.push(...getOpenCutoffs(course));
      }
    );

    return map;
  });

  const allBranchKeys = [
    ...new Set(courseMaps.flatMap((map) => [...map.keys()])),
  ];

  const branches = allBranchKeys.map((branchKey) => {
    const collegeCutoffs = institutes.map((institute, index) => {
      const course = courseMaps[index].get(branchKey);

      return {
        instituteCode: institute.instituteCode,
        instituteName: institute.instituteName,
        branch: course?.branch || null,
        available: Boolean(course?.cutoffs.length),
        category: OPEN_CATEGORY,
        cutoffRecords: course?.cutoffs || [],
      };
    });

    const availableCount = collegeCutoffs.filter(
      (college) => college.available
    ).length;

    let status = "not_available";

    if (availableCount === institutes.length) {
      status = "comparable";
    } else if (availableCount > 0) {
      status = "partially_available";
    }

    return {
      branch: collegeCutoffs.find((college) => college.branch)?.branch,
      status,
      colleges: collegeCutoffs,
    };
  });

  return {
    category: OPEN_CATEGORY,
    categoryDescription: "General Open State category",
    academicYear: masterDataset.metadata?.academicYear || "2026-27",
    admissionRound: "CAP Round I",
    branches,
    comparableBranchCount: branches.filter(
      (branch) => branch.status === "comparable"
    ).length,
    partiallyAvailableBranchCount: branches.filter(
      (branch) => branch.status === "partially_available"
    ).length,
  };
}

function buildCollegeComparisonData(instituteCodes, dataset = masterDataset) {
  const institutes = Array.isArray(dataset?.institutes)
    ? dataset.institutes
    : [];

  const selectedInstitutes = instituteCodes.map((requestedCode) =>
    institutes.find(
      (institute) =>
        String(institute.instituteCode || "")
          .trim()
          .toUpperCase() === requestedCode
    )
  );

  const missingCodes = instituteCodes.filter(
    (_, index) => !selectedInstitutes[index]
  );

  const foundInstitutes = selectedInstitutes.filter(Boolean);

  if (missingCodes.length > 0) {
    return {
      status: "colleges_not_found",
      missingCodes,
      colleges: foundInstitutes,
    };
  }

  const academicYear = dataset?.metadata?.academicYear || "2026-27";

  const collegeOverview = buildCollegeOverview(
    foundInstitutes,
    academicYear
  );

  const branchComparison = buildBranchComparison(foundInstitutes);

  const openCutoffComparison =
    buildOpenCutoffComparison(foundInstitutes);

  return {
    status: "completed",
    instituteCodes,
    collegeOverview,
    branchComparison,
    openCutoffComparison,
    source: {
      academicYear,
      admissionRound: "CAP Round I",
      type: "historical_admissions_dataset",
    },
    limitations: [
      "Fees are unavailable in the current dataset.",
      "Placement information is unavailable in the current dataset.",
      "Verified college locations are unavailable in the current dataset.",
      "Cutoff comparisons use historical 2026-27 CAP Round I records.",
      "Only GOPENS category records are included in cutoff comparison.",
    ],
    disclaimer:
      "This comparison uses available historical admissions records. It is not an official college ranking or a guarantee of admission.",
  };
}

function buildComparisonPrompt(comparisonData) {
  return [
    {
      role: "system",
      content: `You are ClgWise AI College Comparison Assistant.

Your task is to explain a structured comparison of Maharashtra engineering colleges.

Use ONLY the supplied ClgWise dataset.

STRICT RULES:
- Never invent college details, branches, cutoffs, fees, placements, locations, rankings, facilities or accreditation.
- Use only the supplied collegeOverview, branchComparison and openCutoffComparison.
- College overview facts must match the supplied data.
- Explain common branches and college-specific branches accurately.
- Cutoff comparison must use only the supplied GOPENS category records.
- Never mix GOPENS with LOPENS, GOBCS, TFWS, EWS or other categories.
- Compare cutoff percentiles only for the same branch and category.
- Show merit numbers and percentiles only when supplied.
- Clearly identify branches where cutoff data is unavailable.
- Do not interpret missing cutoff records as zero or ineligibility.
- A lower historical cutoff percentile does not prove better college quality.
- Do not declare an objectively best college from incomplete data.
- Fees, placements and verified locations are unavailable. State this clearly when relevant.
- Historical cutoff figures are from 2026-27 CAP Round I.
- Do not make admission guarantees or claim verified 2027-28 eligibility.
- Reply in the same language as the student's request.
- Support English, Marathi and natural Marathi-English.

Provide a structured, practical analysis with:
1. College overview.
2. Branch availability and common branches.
3. GOPENS cutoff comparison.
4. Important differences, data gaps and practical observations.

Do not create numerical values or facts absent from the supplied data.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        collegeOverview: comparisonData.collegeOverview,
        branchComparison: comparisonData.branchComparison,
        openCutoffComparison: comparisonData.openCutoffComparison,
        source: comparisonData.source,
      }),
    },
  ];
}

async function compareColleges({
  instituteCodes,
  dataset = masterDataset,
  completionGenerator = createGroqCompletion,
}) {
  const validation = validateInstituteCodes(instituteCodes);

  if (!validation.valid) {
    return {
      status: "invalid_request",
      error: validation.error,
    };
  }

  const comparisonData = buildCollegeComparisonData(
    validation.instituteCodes,
    dataset
  );

  if (comparisonData.status !== "completed") {
    return {
      ...comparisonData,
      message:
        "One or more institute codes were not found in the official ClgWise dataset.",
    };
  }

  const messages = buildComparisonPrompt(comparisonData);
  const completion = await completionGenerator(messages);

  return {
    status: "completed",
    collegeOverview: comparisonData.collegeOverview,
    branchComparison: comparisonData.branchComparison,
    openCutoffComparison: comparisonData.openCutoffComparison,
    aiAnalysis: completion.answer,
    comparison: completion.answer,
    model: completion.model,
    source: comparisonData.source,
    limitations: comparisonData.limitations,
    disclaimer: comparisonData.disclaimer,
  };
}

module.exports = {
  validateInstituteCodes,
  normalizeBranchName,
  getOpenCutoffs,
  buildCollegeOverview,
  buildBranchComparison,
  buildOpenCutoffComparison,
  buildCollegeComparisonData,
  buildComparisonPrompt,
  compareColleges,
};
