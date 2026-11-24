
const {
    getAdmissionConfig,
  } = require("../eligibility/eligibilityRules");
  
  function resolveStudentCategory(profile = {}) {
    const config = getAdmissionConfig();
  
    if (
      !profile.category ||
      typeof profile.category !== "string" ||
      !profile.category.trim()
    ) {
      return {
        status: "invalid_profile",
        cutoffCategories: [],
        message: "Student category is required.",
      };
    }
  
    const categories = config.officialRules.categories;
  
    if (!Array.isArray(categories) || categories.length === 0) {
      return {
        status: "mapping_pending",
        studentCategory: profile.category,
        cutoffCategories: [],
        message:
          "Official category-to-cutoff mapping for the target academic year is pending.",
        academicYear: config.targetAcademicYear,
        historicalReference: config.historicalReference.academicYear,
      };
    }
  
    const mapping = categories.find((item) => {
      return (
        typeof item.studentCategory === "string" &&
        item.studentCategory.trim().toLowerCase() ===
          profile.category.trim().toLowerCase()
      );
    });
  
    if (
      !mapping ||
      !Array.isArray(mapping.cutoffCategories) ||
      mapping.cutoffCategories.length === 0
    ) {
      return {
        status: "mapping_not_found",
        studentCategory: profile.category,
        cutoffCategories: [],
        message:
          "No verified cutoff mapping exists for this student category.",
      };
    }
  
    return {
      status: "resolved",
      studentCategory: profile.category,
      cutoffCategories: mapping.cutoffCategories,
      academicYear: config.targetAcademicYear,
      sourceUrl: config.officialRules.sourceUrl,
      verifiedAt: config.officialRules.lastVerifiedAt,
    };
  }
  
  module.exports = {
    resolveStudentCategory,
  };
  