
const {
    analyzeCapChoices,
  } = require("../../../lib/ai/capChoiceGuidance");
  
  export default async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
  
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use POST.",
      });
    }
  
    try {
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
          success: false,
          status: "invalid_request",
          error: "A valid request body is required.",
        });
      }
  
      const result = await analyzeCapChoices(req.body);
  
      if (
        result.status === "invalid_request" ||
        result.status === "choice_validation_failed"
      ) {
        return res.status(400).json({
          success: false,
          ...result,
        });
      }
  
      // Structural review succeeded, but historical cutoff guidance
      // is unavailable until category mapping is verified.
      if (result.status === "category_mapping_pending") {
        return res.status(200).json({
          success: true,
          guidanceAvailable: false,
          message:
            "Your college choices were reviewed successfully. Personalized cutoff guidance is temporarily unavailable while category mapping is being verified.",
          ...result,
        });
      }
  
      if (result.status !== "completed") {
        return res.status(422).json({
          success: false,
          guidanceAvailable: false,
          ...result,
        });
      }
  
      return res.status(200).json({
        success: true,
        guidanceAvailable: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "ClgWise CAP Choice Guidance API error:",
        error.message
      );
  
      const statusCode =
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 &&
        error.statusCode < 600
          ? error.statusCode
          : 500;
  
      return res.status(statusCode).json({
        success: false,
        guidanceAvailable: false,
        status: "internal_error",
        error:
          statusCode === 500
            ? "CAP guidance is temporarily unavailable. Please try again later."
            : error.message,
      });
    }
  }
  