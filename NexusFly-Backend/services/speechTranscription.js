const { GoogleGenAI } = require("@google/genai");

function getGeminiClient() {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "API_KEY is not configured."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

async function transcribeSpeech(
  audioBase64,
  mimeType
) {
  if (!audioBase64) {
    throw new Error(
      "Audio data is required."
    );
  }

  if (!mimeType) {
    throw new Error(
      "Audio MIME type is required."
    );
  }

  const ai = getGeminiClient();

  const response =
    await ai.models.generateContent({
      model: "gemini-3.5-transcribe",

      contents: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: `
Transcribe this audio exactly as spoken.

Requirements:
- Automatically detect the spoken language.
- Preserve the original language.
- If the speaker uses Assamese, return Assamese script.
- If the speaker uses Hindi, return Devanagari Hindi.
- If the speaker uses English, return English.
- Preserve the speaker's actual meaning.
- Do not translate the speech into another language.
- Add natural punctuation and capitalization.
- Do not add information that was not spoken.
- Return only the transcription.
          `,
        },
      ],
    });

    const transcriptionPart =
    response.candidates?.[0]?.content?.parts?.find(
      (part) => part.audioTranscription
    );

  return (
    transcriptionPart?.audioTranscription?.text?.trim() ||
    response.text?.trim() ||
    ""
  );
}

module.exports = {
  transcribeSpeech,
};