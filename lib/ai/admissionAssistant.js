
const masterDataset = require("../data/admissions/2026-27/master-colleges.json");

const MAX_CONTEXT_LENGTH = 14000;
const MAX_INSTITUTES = 6;
const MAX_COURSES_PER_INSTITUTE = 4;
const MAX_CUTOFFS_PER_COURSE = 8;

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTerms(question) {
  return normalize(question)
    .split(" ")
    .filter((word) => word.length > 2);
}

function scoreInstitute(institute, terms) {
  const name = normalize(institute.instituteName);
  const searchableCourses = (institute.courses || [])
    .map((course) => normalize(course.branch))
    .join(" ");

  const searchableText = `${name} ${searchableCourses}`;

  return terms.reduce((score, term) => {
    if (name.includes(term)) return score + 4;
    if (searchableText.includes(term)) return score + 2;
    return score;
  }, 0);
}

function buildAdmissionContext(question, dataset = masterDataset) {
  const institutes = Array.isArray(dataset?.institutes)
    ? dataset.institutes
    : [];

  const metadata = dataset?.metadata || {};
  const coverage = metadata.coverage || {};

  const terms = getSearchTerms(question);

  const rankedInstitutes = institutes
    .map((institute) => ({
      institute,
      score: scoreInstitute(institute, terms),
    }))
    .filter((item) => item.score >= 6)
    .sort((a, b) => b.score - a.score);

  const selectedInstitutes = rankedInstitutes
    .slice(0, MAX_INSTITUTES)
    .map(({ institute }) => ({
      instituteCode: institute.instituteCode || null,
      instituteName: institute.instituteName || "Unknown institute",
      cutoffAvailable: institute.cutoffAvailable === true,
      cutoffRound: institute.cutoffRound || null,
      courses: (institute.courses || [])
        .slice(0, MAX_COURSES_PER_INSTITUTE)
        .map((course) => ({
          courseCode: course.courseCode || null,
          branch: course.branch || "Unknown branch",
          status: course.status || null,
          homeUniversity: course.homeUniversity || null,
          cutoffRecords: (course.cutoffRecords || [])
            .slice(0, MAX_CUTOFFS_PER_COURSE)
            .map((record) => ({
              category: record.category || null,
              meritNumber: record.meritNumber ?? null,
              percentile: record.percentile ?? null,
            })),
        })),
    }));

  const context = {
    source: "ClgWise master admissions dataset",
    academicYear: metadata.academicYear || "2026-27",
    admissionRound: "CAP Round I",
    coverage: {
      totalOfficialInstitutes: coverage.totalOfficialInstitutes ?? null,
      institutesWithCutoff: coverage.institutesWithCutoff ?? null,
      institutesWithoutCutoff: coverage.institutesWithoutCutoff ?? null,
      totalCourses: coverage.totalCourses ?? null,
      totalCutoffRecords: coverage.totalCutoffRecords ?? null,
    },
    matchingInstitutesFound: selectedInstitutes.length,
    matchingInstitutes: selectedInstitutes,
    limitations: [
      "The dataset contains historical 2026-27 CAP Round I cutoff information.",
      "Historical cutoffs are not guaranteed future admission cutoffs.",
      "Missing cutoff records must not be estimated or invented.",
      "The dataset does not confirm 2027-28 official eligibility or seat allocation rules.",
      "Gender and special-reservation seat allocation are not verified in the historical matching engine.",
    ],
  };

  let serialized = JSON.stringify(context);

  if (serialized.length > MAX_CONTEXT_LENGTH) {
    context.matchingInstitutes = context.matchingInstitutes.slice(0, 2);
    serialized = JSON.stringify(context);
  }

  return serialized.slice(0, MAX_CONTEXT_LENGTH);
}

function validateConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      valid: false,
      error: "At least one message is required.",
    };
  }

  if (messages.length > 10) {
    return {
      valid: false,
      error: "A maximum of 10 conversation messages is allowed.",
    };
  }

  const sanitizedMessages = [];

  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      return {
        valid: false,
        error: "Each message must have a valid user or assistant role and text content.",
      };
    }

    const content = message.content.trim();

    if (!content || content.length > 3000) {
      return {
        valid: false,
        error: "Messages must contain between 1 and 3000 characters.",
      };
    }

    sanitizedMessages.push({
      role: message.role,
      content,
    });
  }

  if (sanitizedMessages[sanitizedMessages.length - 1].role !== "user") {
    return {
      valid: false,
      error: "The latest message must be from the user.",
    };
  }

  return {
    valid: true,
    messages: sanitizedMessages,
  };
}

module.exports = {
  buildAdmissionContext,
  validateConversation,
};
