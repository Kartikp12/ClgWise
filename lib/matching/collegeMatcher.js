
function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }
  

  const STANDARD_SEAT_PATTERN = /^([GL])(OPEN|OBC|SC|ST|VJ|NT1|NT2|NT3|SEBC)S$/;

function isGenderCompatibleCutoff(category, gender) {
  const normalizedCategory = String(category || "")
    .trim()
    .toUpperCase();

  const match = normalizedCategory.match(STANDARD_SEAT_PATTERN);

  // Keep special reservation and other seat codes unchanged.
  if (!match) {
    return true;
  }

  const seatGroup = match[1];

  if (gender === "male") {
    return seatGroup === "G";
  }

  if (gender === "female") {
    return seatGroup === "G" || seatGroup === "L";
  }

  // Do not assume a seat restriction for unspecified/other gender.
  return true;
}

function getCutoffCategoryLabel(category) {
  const normalizedCategory = String(category || "")
    .trim()
    .toUpperCase();

  const match = normalizedCategory.match(STANDARD_SEAT_PATTERN);

  if (!match) {
    return "Special or other seat category";
  }

  const seatGroup = match[1] === "G"
    ? "General (gender-neutral)"
    : "Ladies";

  const reservationCategory = match[2];

  return `${seatGroup} ${reservationCategory} Seat`;
}


  function matchColleges({
    colleges = [],
    percentile,
    cutoffCategories = [],
    preferredBranches = [],
    homeUniversity,
    gender,
    specialReservations = [],
  }) {
    if (!Array.isArray(colleges)) {
      throw new Error("Colleges must be an array.");
    }
  
    if (
      typeof percentile !== "number" ||
      !Number.isFinite(percentile) ||
      percentile < 0 ||
      percentile > 100
    ) {
      throw new Error("Percentile must be between 0 and 100.");
    }
  
    if (!Array.isArray(cutoffCategories) || cutoffCategories.length === 0) {
      return {
        status: "category_mapping_pending",
        matches: [],
        message:
          "Cannot compare cutoffs until verified cutoff categories are resolved.",
      };
    }
  
    if (!Array.isArray(preferredBranches)) {
      throw new Error("Preferred branches must be an array.");
    }
  
    if (!Array.isArray(specialReservations)) {
      throw new Error("Special reservations must be an array.");
    }
  
    const categories = new Set(
      cutoffCategories.map((item) => normalize(item).toUpperCase())
    );
  
    const branches = preferredBranches.map(normalize);
    const reservations = specialReservations.map(normalize);
  
    const matches = [];
  
    let coursesWithoutCutoff = 0;
    let coursesWithoutMatchingCategory = 0;
    let institutesWithoutCourses = 0;
    let recordsWithoutSeatMetadata = 0;
  
    for (const college of colleges) {
      const courses = Array.isArray(college.courses)
        ? college.courses
        : [];
  
      if (courses.length === 0) {
        institutesWithoutCourses++;
        continue;
      }
  
      for (const course of courses) {
        const records = Array.isArray(course.cutoffRecords)
          ? course.cutoffRecords
          : [];
  
        if (records.length === 0) {
          coursesWithoutCutoff++;
          continue;
        }
  
        const relevantRecords = records.filter((record) => {
          const category = normalize(record.category).toUpperCase();
        
          return (
            categories.has(category) &&
            isGenderCompatibleCutoff(category, gender)
          );
        });
  
        if (relevantRecords.length === 0) {
          coursesWithoutMatchingCategory++;
          continue;
        }
  
        const branch = course.branch || "Unknown";
  
        const branchPreferred =
          branches.length === 0 || branches.includes(normalize(branch));
  
        const courseUniversity = normalize(course.homeUniversity);
  
        const homeUniversityMatch =
          !homeUniversity ||
          !courseUniversity ||
          courseUniversity === normalize(homeUniversity);
  
        for (const record of relevantRecords) {
          const cutoff = Number(record.percentile);
  
          if (
            !Number.isFinite(cutoff) ||
            cutoff < 0 ||
            cutoff > 100
          ) {
            continue;
          }
  
          const difference = Number((percentile - cutoff).toFixed(4));
  
          const hasSeatMetadata =
            Boolean(record.seatType) ||
            Boolean(record.gender) ||
            Boolean(record.reservation);
  
          if (!hasSeatMetadata) {
            recordsWithoutSeatMetadata++;
          }
  
          // Never assume missing seat metadata means ineligible.
          const reservationMetadataAvailable =
            hasSeatMetadata || reservations.length === 0;
  
          matches.push({
            collegeCode: college.collegeCode || college.instituteCode,
            collegeName: college.collegeName || college.instituteName,
            courseCode: course.courseCode,
            branch,
            courseStatus: course.status || null,
  
            homeUniversity: course.homeUniversity || null,
            homeUniversityMatch,
  
            cutoffCategory: record.category,
            cutoffCategoryLabel: getCutoffCategoryLabel(record.category),
            historicalCutoffPercentile: cutoff,
            studentPercentile: percentile,
            percentileDifference: difference,
            meetsHistoricalCutoff: difference >= 0,
  
            branchPreferred,
  
            seatMetadataAvailable: hasSeatMetadata,
            reservationMetadataAvailable,
  
            // These are informational only until verified seat rules exist.
            genderApplied: false,
            specialReservationsApplied: false,
  
            academicYear: "2026-27",
            admissionRound: "CAP Round I",
            resultType: "historical_comparison",
          });
        }
      }
    }
  
    matches.sort((a, b) => {
      if (a.branchPreferred !== b.branchPreferred) {
        return Number(b.branchPreferred) - Number(a.branchPreferred);
      }
  
      if (a.homeUniversityMatch !== b.homeUniversityMatch) {
        return Number(b.homeUniversityMatch) -
          Number(a.homeUniversityMatch);
      }
  
      return b.percentileDifference - a.percentileDifference;
    });
  
    return {
      status: "completed",
      academicYear: "2026-27",
      resultType: "historical_comparison",
  
      totalMatches: matches.length,
      coursesWithoutCutoff,
      coursesWithoutMatchingCategory,
      institutesWithoutCourses,
      recordsWithoutSeatMetadata,
  
      matchingCoverage: {
        branchPreferenceApplied: true,
        homeUniversityUsedForRanking: Boolean(homeUniversity),
        genderApplied: gender === "male" || gender === "female",
        specialReservationsApplied: false,
        reason:
        "Gender-based filtering is applied to standard General and Ladies cutoff categories. Special reservation and other seat categories are not gender-filtered by this matcher.",
      },
  
      matches,
  
      disclaimer:
        "Historical CAP Round I cutoff comparison only. This is not a seat-allocation simulation and does not confirm 2027-28 eligibility or admission.",
    };
  }
  
  module.exports = {
    matchColleges,
  };
  