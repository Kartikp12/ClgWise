
const {
    getPersonalizedSuggestions,
  } = require("../../../lib/ai/personalizedSuggestions");
  
  export default async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
  
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
    }
  
    const studentProfile = req.body?.studentProfile;
  
    if (
      !studentProfile ||
      typeof studentProfile !== "object" ||
      Array.isArray(studentProfile)
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid studentProfile object is required.",
      });
    }
  
    try {
      const result = await getPersonalizedSuggestions({
        studentProfile,
      });
  
      if (result.status === "invalid_profile") {
        return res.status(400).json({
          success: false,
          ...result,
        });
      }
  
      if (result.status === "category_mapping_pending") {
        return res.status(409).json({
          success: false,
          ...result,
        });
      }
  
      if (result.status !== "completed") {
        return res.status(200).json({
          success: true,
          ...result,
        });
      }
  
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "ClgWise Personalized Suggestions error:",
        error.message
      );
  
      return res.status(error.statusCode || 500).json({
        success: false,
        error:
          error.statusCode
            ? error.message
            : "Something went wrong while generating personalized college suggestions.",
      });
    }
  }
  