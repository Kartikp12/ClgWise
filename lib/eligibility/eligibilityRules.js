
const ADMISSION_CONFIG = {
    targetAcademicYear: "2027-28",
  
    historicalReference: {
      academicYear: "2026-27",
      datasetPath: "lib/data/admissions/2026-27/master-colleges.json",
      cutoffFile: "lib/data/admissions/2026-27/cap-round-1.json",
      admissionRound: "CAP Round I",
      usage: "historical_prediction_reference",
    },
  
    officialRules: {
      status: "pending_official_release",
      sourceUrl: null,
      lastVerifiedAt: null,
      categories: [],
      seatTypes: [],
      candidatureTypes: [],
      reservationRules: null,
    },
  
    prediction: {
      safeMargin: 2,
      moderateMargin: -2,
      maximumConfidence: 60,
    },
  };
  
  function getAdmissionConfig() {
    return ADMISSION_CONFIG;
  }
  
  function areOfficialRulesAvailable() {
    const rules = ADMISSION_CONFIG.officialRules;
  
    return (
      rules.status === "published" &&
      Array.isArray(rules.categories) &&
      rules.categories.length > 0 &&
      Array.isArray(rules.candidatureTypes) &&
      rules.candidatureTypes.length > 0
    );
  }
  
  // Configure only after the official brochure/rules are verified.
  // This function deliberately does not invent category mappings.
  function configureOfficialRules(rules) {
    if (!rules || typeof rules !== "object") {
      throw new Error("Official rules configuration is required.");
    }
  
    if (
      !Array.isArray(rules.categories) ||
      !Array.isArray(rules.candidatureTypes) ||
      !Array.isArray(rules.seatTypes)
    ) {
      throw new Error(
        "Categories, candidatureTypes and seatTypes must be arrays."
      );
    }
  
    if (!rules.sourceUrl || !rules.lastVerifiedAt) {
      throw new Error(
        "Official source URL and verification date are required."
      );
    }
  
    ADMISSION_CONFIG.officialRules = {
      status: "published",
      sourceUrl: rules.sourceUrl,
      lastVerifiedAt: rules.lastVerifiedAt,
      categories: rules.categories,
      seatTypes: rules.seatTypes,
      candidatureTypes: rules.candidatureTypes,
      reservationRules: rules.reservationRules || null,
    };
  
    return getAdmissionConfig();
  }
  
  module.exports = {
    getAdmissionConfig,
    areOfficialRulesAvailable,
    configureOfficialRules,
  };
  