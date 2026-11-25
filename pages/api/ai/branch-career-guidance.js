
import { getBranchCareerGuidance } from "../../../lib/ai/branchCareerGuidance";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      status: "error",
      message: "Method not allowed. Use POST.",
    });
  }

  try {
    const result = await getBranchCareerGuidance({
      request: req.body,
    });

    if (result.status === "invalid_request") {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Branch Career Guidance API Error:", error);

    const statusCode =
      error.status === 503
        ? 503
        : 502;

    return res.status(statusCode).json({
      status: "error",
      message:
        statusCode === 503
          ? "AI service is not configured."
          : "Unable to generate branch and career guidance. Please try again.",
    });
  }
}
