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

Language/script rules:
- Assamese speech MUST be returned in Assamese Unicode script.
- NEVER return Assamese speech in Roman/Latin letters.
- Hindi speech MUST be returned in Devanagari script.
- NEVER return Hindi speech in Roman/Latin letters.
- English speech MUST be returned in English.

- Preserve the speaker's actual words and meaning.
- Do not translate the speech into another language.
- Add natural punctuation and capitalization.
- Do not add information that was not spoken.
- Return only the final transcription.


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