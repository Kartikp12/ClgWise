
const ACADEMIC_YEAR_CONFIGS = {
    "2026-27": {
      academicYear: "2026-27",
  
      instituteSource: {
        name: "Maharashtra State CET Cell",
        url: "https://fe2026.mahacet.org/StaticPages/frmInstituteWiseAllotmentList",
        expectedCount: 387,
      },
  
      cutoffSource: {
        name: "Maharashtra CET Cell",
        url: "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf",
        admissionRound: "CAP Round I",
        roundName: "CAP Round 1",
        seatType: "Maharashtra & Minority Seats",
      },
  
      validation: {
        maxAcceptedParsingErrors: 204,
        maxFailedPages: 0,
        maxDuplicateCourses: 0,
        maxDuplicateInstitutes: 0,
        maxUnmatchedColleges: 0,
      },
    },
  };
  
  function getAdmissionsConfig(academicYear) {
    const selectedYear =
      academicYear ||
      process.env.CLGWISE_ACADEMIC_YEAR ||
      "2026-27";
  
    const config = ACADEMIC_YEAR_CONFIGS[selectedYear];
  
    if (!config) {
      throw new Error(
        `Academic year configuration not found: ${selectedYear}. Add its official sources and validation settings to admissionsConfig.js first.`
      );
    }
  
    return config;
  }
  
  module.exports = {
    ACADEMIC_YEAR_CONFIGS,
    getAdmissionsConfig,
  };
  