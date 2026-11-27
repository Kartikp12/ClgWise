
const CATEGORY_ALIASES = {
  OPEN: "OPEN",
  GENERAL: "OPEN",
  OC: "OPEN",

  OBC: "OBC",
  OTHER_BACKWARD_CLASS: "OBC",

  SC: "SC",
  SCHEDULED_CASTE: "SC",

  ST: "ST",
  SCHEDULED_TRIBE: "ST",

  VJ: "VJ",
  VJNT: "VJ",
  "VJ/DT": "VJ",
  "DT-VJ": "VJ",

  NT1: "NT1",
  "NT-A": "NT1",
  NTA: "NT1",

  NT2: "NT2",
  "NT-B": "NT2",
  NTB: "NT2",

  NT3: "NT3",
  "NT-C": "NT3",
  NTC: "NT3",

  "NT-D": "NT3",
  NTD: "NT3",

  SEBC: "SEBC",
  EWS: "EWS",
};

const HISTORICAL_CUTOFF_CODES = {
  OPEN: ["GOPENS", "LOPENS"],
  OBC: ["GOBCS", "LOBCS"],
  SC: ["GSCS", "LSCS"],
  ST: ["GSTS", "LSTS"],
  VJ: ["GVJS", "LVJS"],
  NT1: ["GNT1S", "LNT1S"],
  NT2: ["GNT2S", "LNT2S"],
  NT3: ["GNT3S", "LNT3S"],
  SEBC: ["GSEBCS", "LSEBCS"],
  EWS: ["EWS"],
};

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function resolveStudentCategory(profile = {}) {
  const rawCategory = normalizeCategory(profile.category);
  const normalizedCategory = CATEGORY_ALIASES[rawCategory];

  if (!normalizedCategory) {
    return {
      status: "mapping_not_found",
      studentCategory: profile.category || null,
      cutoffCategories: [],
      message:
        "This category does not have a supported historical cutoff mapping.",
    };
  }

  const reservedCodes =
    HISTORICAL_CUTOFF_CODES[normalizedCategory];

  if (!reservedCodes) {
    return {
      status: "mapping_not_found",
      studentCategory: profile.category,
      cutoffCategories: [],
      message:
        "No historical cutoff records are configured for this category.",
    };
  }

  // Candidates from every reservation category can also compete
  // for Open seats on merit. Include Open records in the comparison.
  const openCodes =
    normalizedCategory === "OPEN"
      ? []
      : HISTORICAL_CUTOFF_CODES.OPEN;

  const cutoffCategories = [
    ...new Set([...openCodes, ...reservedCodes]),
  ];

  return {
    status: "resolved",
    mappingType: "historical_dataset",
    studentCategory: profile.category,
    normalizedCategory,
    cutoffCategories,
    verifiedFor: "2026-27 CAP Round I historical comparison",
    officialEligibilityVerified: false,
    message:
      "Historical cutoff categories were resolved using the 2026-27 CAP Round I dataset. This does not verify 2027-28 admission eligibility.",
    academicYear: "2026-27",
  };
}

module.exports = {
  resolveStudentCategory,
};
