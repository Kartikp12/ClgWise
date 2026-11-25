
const {
    compareColleges,
  } = require("../../../lib/ai/collegeComparison");
  
  export default async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
  
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
    }
  
    const instituteCodes = req.body?.instituteCodes;
  
    if (!Array.isArray(instituteCodes)) {
      return res.status(400).json({
        success: false,
        error: "instituteCodes array is required.",
      });
    }
  
    try {
      const result = await compareColleges({
        instituteCodes,
      });
  
      if (result.status === "invalid_request") {
        return res.status(400).json({
          success: false,
          ...result,
        });
      }
  
      if (result.status === "colleges_not_found") {
        return res.status(404).json({
          success: false,
          ...result,
        });
      }
  
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "ClgWise College Comparison error:",
        error.message
      );
  
      return res.status(error.statusCode || 500).json({
        success: false,
        error:
          error.statusCode
            ? error.message
            : "Something went wrong while comparing colleges.",
      });
    }
  }
  