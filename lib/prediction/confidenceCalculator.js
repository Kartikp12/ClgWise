
function calculatePredictionConfidence({
    historicalCutoff,
    matchingCategory,
    matchingExam,
    matchingAcademicYear,
  }) {
    const factors = {
      historicalCutoff: Boolean(historicalCutoff),
      matchingCategory: Boolean(matchingCategory),
      matchingExam: Boolean(matchingExam),
      matchingAcademicYear: Boolean(matchingAcademicYear),
    };
  
    let score = 0;
  
    if (factors.historicalCutoff) score += 30;
    if (factors.matchingCategory) score += 30;
    if (factors.matchingExam) score += 20;
    if (factors.matchingAcademicYear) score += 20;
  
    // One historical admission year cannot justify high confidence.
    score = Math.min(score, 60);
  
    let level = "low";
  
    if (score >= 50) {
      level = "moderate";
    }
  
    return {
      score,
      level,
      factors,
  
      dataLimitation:
        "Predictions currently use only 2026-27 CAP Round I historical cutoffs.",
  
      disclaimer:
        "Confidence indicates data completeness, not the probability or guarantee of admission.",
    };
  }
  
  module.exports = {
    calculatePredictionConfidence,
  };
  