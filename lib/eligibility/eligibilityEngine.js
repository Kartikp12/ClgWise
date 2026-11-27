
const {
    getAdmissionConfig,
    areOfficialRulesAvailable,
  } = require("./eligibilityRules");
  
  const ALLOWED_EXAMS = ["MHT-CET"];
  
  const ALLOWED_GENDERS = [
    "male",
    "female",
    "other",
  ];
  
  function validateStudentProfile(profile = {}) {
    const errors = [];
  
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return {
        valid: false,
        errors: ["Student profile must be an object."],
      };
    }
  
    if (!ALLOWED_EXAMS.includes(profile.examType)) {
      errors.push("Currently, only MHT-CET is supported.");
    }
  
    if (
      profile.isResultDeclared !== undefined &&
      typeof profile.isResultDeclared !== "boolean"
    ) {
      errors.push("isResultDeclared must be a boolean.");
    }
  
    const resultDeclared = profile.isResultDeclared === true;
  
    const percentile = resultDeclared
      ? profile.percentile
      : profile.expectedPercentile ?? profile.percentile;
  
    if (
      typeof percentile !== "number" ||
      !Number.isFinite(percentile) ||
      percentile < 0 ||
      percentile > 100
    ) {
      errors.push(
        resultDeclared
          ? "Actual percentile must be a number between 0 and 100."
          : "Expected percentile must be a number between 0 and 100."
      );
    }
  
    if (
      typeof profile.category !== "string" ||
      !profile.category.trim()
    ) {
      errors.push("Student category is required.");
    }
  
    if (
      profile.candidatureType !== undefined &&
      profile.candidatureType !== null &&
      typeof profile.candidatureType !== "string"
    ) {
      errors.push("Candidature type must be a string.");
    }
  
    if (
      profile.gender !== undefined &&
      (
        typeof profile.gender !== "string" ||
        !ALLOWED_GENDERS.includes(profile.gender.toLowerCase())
      )
    ) {
      errors.push("Gender must be Male, Female or Other.");
    }
  
    if (
      profile.homeUniversity !== undefined &&
      typeof profile.homeUniversity !== "string"
    ) {
      errors.push("Home University must be a string.");
    }
  
    if (
      profile.specialReservations !== undefined &&
      (
        !Array.isArray(profile.specialReservations) ||
        !profile.specialReservations.every(
          (item) => typeof item === "string" && item.trim()
        )
      )
    ) {
      errors.push(
        "Special reservations must be an array of non-empty strings."
      );
    }
  
    if (
      profile.preferredBranches !== undefined &&
      (
        !Array.isArray(profile.preferredBranches) ||
        !profile.preferredBranches.every(
          (item) => typeof item === "string" && item.trim()
        )
      )
    ) {
      errors.push(
        "Preferred branches must be an array of non-empty strings."
      );
    }
  
    return {
      valid: errors.length === 0,
      errors,
      percentile,
      predictionMode: resultDeclared
        ? "actual_percentile"
        : "expected_percentile",
    };
  }
  
  function evaluateEligibility(profile = {}) {
    const validation = validateStudentProfile(profile);
    const config = getAdmissionConfig();
  
    if (!validation.valid) {
      return {
        status: "invalid_profile",
        eligible: null,
        errors: validation.errors,
        predictionAllowed: false,
      };
    }
  
    if (!areOfficialRulesAvailable()) {
      return {
        status: "rules_pending",
        eligible: null,
        academicYear: config.targetAcademicYear,
        predictionAllowed: true,
        predictionSource: config.historicalReference.academicYear,
        message:
          "Official admission rules are pending. Confirmed 2027-28 eligibility cannot be determined yet.",
      };
    }
  
    // Rules are configured, but eligibility must only be confirmed
    // after the relevant rule evaluator has been implemented and verified.
    return {
      status: "rules_configured",
      eligible: null,
      academicYear: config.targetAcademicYear,
      predictionAllowed: true,
      message:
        "Official rules are configured. A verified seat-level eligibility evaluation is still required.",
    };
  }
  
  module.exports = {
    validateStudentProfile,
    evaluateEligibility,
  };
  