
const {
    validateStudentProfile,
    evaluateEligibility,
  } = require("../eligibility/eligibilityEngine");
  
  const {
    matchColleges,
  } = require("../matching/collegeMatcher");
  
  const {
    resolveStudentCategory,
  } = require("../matching/categoryResolver");
  
  const {
    classifyAdmissionChance,
  } = require("./chanceClassifier");
  
  const {
    calculatePredictionConfidence,
  } = require("./confidenceCalculator");
  
  function generatePredictions({
    colleges = [],
    studentProfile = {},
    cutoffCategories,
    categoryMappingVerified = false,
  }) {
    const validation = validateStudentProfile(studentProfile);
  
    if (!validation.valid) {
      return {
        status: "invalid_profile",
        predictions: [],
        errors: validation.errors,
        message:
          "Please correct the student profile before generating predictions.",
      };
    }
  
    const eligibility = evaluateEligibility(studentProfile);
  
    const categoryResult = resolveStudentCategory(studentProfile);
  
    // Explicit cutoff categories are accepted for historical testing
    // or when supplied by a verified upstream rules resolver.
    const resolvedCategories =
      Array.isArray(cutoffCategories) && cutoffCategories.length > 0
        ? cutoffCategories
        : categoryResult.cutoffCategories;
  
        const mappingVerified =
        categoryMappingVerified === true ||
        categoryResult.status === "resolved";
  
    const percentile = validation.percentile;
  
    const matchingResult = matchColleges({
      colleges,
      percentile,
      cutoffCategories: resolvedCategories,
      preferredBranches: studentProfile.preferredBranches || [],
      homeUniversity: studentProfile.homeUniversity,
      gender: studentProfile.gender,
      specialReservations: studentProfile.specialReservations || [],
    });
  
    if (matchingResult.status !== "completed") {
      return {
        status: matchingResult.status,
        predictions: [],
        eligibility,
        categoryResolution: categoryResult,
        message: matchingResult.message,
      };
    }
  
    const predictions = matchingResult.matches.map((match) => {
      const chance = classifyAdmissionChance(
        match.percentileDifference
      );
  
      const confidence = calculatePredictionConfidence({
        historicalCutoff: true,
        matchingCategory: mappingVerified,
        matchingExam: true,
        matchingAcademicYear: false,
      });
  
      let recommendationExplanation;
  
      if (match.percentileDifference > 0) {
        recommendationExplanation =
          `Your percentile is ${match.percentileDifference.toFixed(2)} points above the historical cutoff.`;
      } else if (match.percentileDifference < 0) {
        recommendationExplanation =
          `Your percentile is ${Math.abs(match.percentileDifference).toFixed(2)} points below the historical cutoff.`;
      } else {
        recommendationExplanation =
          "Your percentile exactly meets the historical cutoff.";
      }
  
      const preferenceNotes = [];
  
      if (match.branchPreferred) {
        preferenceNotes.push("Matches preferred branch.");
      }
  
      if (studentProfile.homeUniversity) {
        preferenceNotes.push(
          match.homeUniversityMatch
            ? "Home University matches or is not specified in the course data."
            : "Course has a different Home University; shown for comparison."
        );
      }
  
      return {
        ...match,
  
        chance: chance.classification,
        chanceExplanation: chance.explanation,
        recommendationExplanation,
  
        preferenceNotes,
  
        confidence,
      };
    });
  
    const summary = {
      total: predictions.length,
      safe: predictions.filter(
        (item) => item.chance === "safe"
      ).length,
      moderate: predictions.filter(
        (item) => item.chance === "moderate"
      ).length,
      ambitious: predictions.filter(
        (item) => item.chance === "ambitious"
      ).length,
    };
  
    return {
      status: "completed",
  
      targetAcademicYear: "2027-28",
      referenceAcademicYear: "2026-27",
  
      predictionMode: validation.predictionMode,
      percentileUsed: percentile,
  
      eligibility,
  
      categoryResolution: {
        status: categoryResult.status,
        message: categoryResult.message || null,
        verified: mappingVerified,
        cutoffCategories: mappingVerified
          ? resolvedCategories
          : [],
      },
  
      summary,
  
      dataQuality: {
        totalMatches: matchingResult.totalMatches,
        coursesWithoutCutoff: matchingResult.coursesWithoutCutoff,
        coursesWithoutMatchingCategory:
          matchingResult.coursesWithoutMatchingCategory,
        institutesWithoutCourses:
          matchingResult.institutesWithoutCourses,
        recordsWithoutSeatMetadata:
          matchingResult.recordsWithoutSeatMetadata,
        categoryMappingVerified: mappingVerified,
        matchingCoverage: matchingResult.matchingCoverage,
      },
  
      predictions,
  
      disclaimer:
        "These are estimates based on 2026-27 CAP Round I historical cutoffs. They are not confirmed 2027-28 eligibility, official admission chances, a seat-allocation simulation, or a guarantee of admission. Gender and special-reservation seat rules are not applied without verified seat-level data.",
    };
  }
  
  module.exports = {
    generatePredictions,
  };
  