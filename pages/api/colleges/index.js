
const masterDataset = require("../../../lib/data/admissions/2026-27/master-colleges.json");

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
  }

  const institutes = Array.isArray(masterDataset.institutes)
    ? masterDataset.institutes
    : [];

  const colleges = institutes.map((institute) => ({
    instituteCode: String(institute.instituteCode || ""),
    instituteName: institute.instituteName || "Unknown college",
    cutoffAvailable: institute.cutoffAvailable === true,
    totalBranches: Array.isArray(institute.courses)
      ? institute.courses.length
      : 0,
  }));

  return res.status(200).json({
    success: true,
    total: colleges.length,
    colleges,
  });
}
