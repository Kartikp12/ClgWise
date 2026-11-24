
const CLASSIFICATION_THRESHOLDS = {
    safe: 2,
    moderate: -2,
  };
  
  function classifyAdmissionChance(percentileDifference) {
    if (
      typeof percentileDifference !== "number" ||
      !Number.isFinite(percentileDifference)
    ) {
      return {
        classification: "insufficient_data",
        explanation: "A valid historical cutoff comparison is unavailable.",
      };
    }
  
    if (percentileDifference >= CLASSIFICATION_THRESHOLDS.safe) {
      return {
        classification: "safe",
        explanation:
          "Your percentile is at least 2 points above the historical cutoff. This is a historical comparison, not an admission guarantee.",
      };
    }
  
    if (percentileDifference >= CLASSIFICATION_THRESHOLDS.moderate) {
      return {
        classification: "moderate",
        explanation:
          "Your percentile is within 2 points below or above the historical cutoff.",
      };
    }
  
    return {
      classification: "ambitious",
      explanation:
        "Your percentile is more than 2 points below the historical cutoff.",
    };
  }
  
  module.exports = {
    classifyAdmissionChance,
    CLASSIFICATION_THRESHOLDS,
  };
  