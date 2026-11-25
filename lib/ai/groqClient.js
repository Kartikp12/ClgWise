
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function createGroqCompletion(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  if (!apiKey) {
    const error = new Error("Groq API key is not configured.");
    error.statusCode = 503;
    throw error;
  }

  let response;

  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 3000,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    const requestError = new Error(
      error.name === "TimeoutError"
        ? "The AI service took too long to respond. Please try again."
        : "Unable to connect to the AI service. Please try again."
    );

    requestError.statusCode = 502;
    throw requestError;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? "Groq authentication failed. Check the configured API key."
        : response.status === 429
          ? "The AI service is temporarily rate limited. Please try again shortly."
          : "The AI service could not process this request."
    );

    error.statusCode =
      response.status === 401 ? 503 :
      response.status === 429 ? 429 : 502;

    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("The AI service returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return {
    answer: content.trim(),
    model: data.model || model,
  };
}

module.exports = {
  createGroqCompletion,
};
