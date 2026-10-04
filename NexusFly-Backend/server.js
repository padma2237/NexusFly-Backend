require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

const {
  searchWeb
} = require("./services/webSearch");

const {
  transcribeSpeech,
} = require("./services/speechTranscription");

app.use(cors());
app.use(express.json({
  limit: "25mb",
}));

app.use(express.static("Public"));

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite",
});

// Update your main route to send the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});



app.post('/ask', async (req, res) => {
  try {
    const {
      contents,
      webSearch
    } = req.body;

    console.log("Web Search:", webSearch);

    let searchResults = null;
    let finalContents = contents;

    // =========================
    // LAST MESSAGE
    // =========================

    const lastMessage =
      contents[contents.length - 1];

    const userQuery =
      lastMessage?.parts
        ?.find((part) => part.text)
        ?.text
        ?.trim() || "";

    const attachmentParts =
      lastMessage?.parts?.filter(
        (part) => part.inlineData
      ) || [];

    const hasImages =
      attachmentParts.length > 0;

    // =========================
    // WEB SEARCH
    // =========================

    if (webSearch) {

      // ---------------------------------
      // CASE 1:
      // Normal text query
      // ---------------------------------

      if (userQuery) {

        console.log(
          "Web search query:",
          userQuery
        );

        searchResults =
          await searchWeb(userQuery);

      }

      // ---------------------------------
      // CASE 2:
      // Image-only query
      // ---------------------------------

      else if (hasImages) {

        console.log(
          "Image-only web search detected."
        );

        const queryGenerationResult =
          await model.generateContent({
            systemInstruction: `
You are a visual search-query generator.

Analyze the supplied image only for information
that can reasonably be determined from the image.

Your task is to produce ONE concise web-search
query that can help identify or research what is
shown in the image.

Important rules:
- Do not invent facts.
- Do not assume a current year.
- Do not rely on your stored knowledge for current facts.
- Use visible text, logos, labels, model numbers,
  names, distinctive identifiers, or other reliable
  visual clues.
- If the exact identity is uncertain, use descriptive
  search terms instead of pretending to know it.
- Return ONLY the search query.
- Do not explain your reasoning.
`,
            contents: [
              {
                role: "user",
                parts: attachmentParts,
              },
            ],
          });

        const generatedQuery =
          queryGenerationResult.response
            .text()
            .trim();

        console.log(
          "Generated image search query:",
          generatedQuery
        );

        if (generatedQuery) {
          searchResults =
            await searchWeb(generatedQuery);
        }
      }

      // ---------------------------------
      // Add search results to final prompt
      // ---------------------------------

      if (
        searchResults?.results?.length
      ) {

        const searchContext = `
Live Web Search Results:

${searchResults.results
  .map(
    (r, i) => `${i + 1}. ${r.title}
URL: ${r.url}
Summary: ${r.content}`
  )
  .join("\n\n")}

Use the live web search results above when
answering the user's request.

${userQuery
  ? `User Question:
${userQuery}`
  : "The user provided an image without a written question."}
`;

        finalContents = [...contents];

        finalContents[
          finalContents.length - 1
        ] = {
          role: "user",
          parts: [
            {
              text: searchContext,
            },
            ...attachmentParts,
          ],
        };
      }
    }

    // =========================
    // GEMINI
    // =========================

{/*
    const result =
      await model.generateContent({
        systemInstruction:
          "You are Padmaria, a creative and friendly assistant. Never introduce yourself repeatedly. Answer the user's questions directly and creatively.",
        contents: finalContents,
      });
      
      */}
      
          // =========================
    // GEMINI SYSTEM INSTRUCTION LOGIC
    // =========================

    let systemInstruction = "You are Padmaria, a creative and friendly assistant. Never introduce yourself repeatedly. Answer the user's questions directly and creatively.";

    // Check if the user query contains the trigger word "MARIA" (case-insensitive)
    if (userQuery.toLowerCase().includes("maria")) {
      systemInstruction = `
You are Padmaria, a creative and friendly assistant. 
SPECIAL PROTOCOL ACTIVE: The user has addressed you as 'MARIA'. 
- You must be exceptionally sweet, warm, and radiant.
- Use beautiful, uplifting language.
- Incorporate Markdown highlights (bold, italics, headers) and a variety of sparkling emojis.
- Explicitly tell her that her special has sent a beautiful message just for her.
- Make the tone feel like a magical, personalized transmission.
- Keep your answers creative and highly engaging.
`;
    }

    const result = await model.generateContent({
      systemInstruction: systemInstruction,
      contents: finalContents,
    });



    const answer =
      result.response.text();

    // =========================
    // SOURCES
    // =========================

    const sources =
      webSearch &&
      searchResults?.results
        ? searchResults.results.map(
            (result) => ({
              title: result.title,
              url: result.url,
            })
          )
        : [];

    // =========================
    // RESPONSE
    // =========================

    res.json({
      answer,
      sources,
    });

  } catch (error) {

    console.error(
      "Full API Error:"
    );

    if (error instanceof Error) {
      console.error(
        error.message
      );
    } else {
      console.error(error);
    }

    res.status(500).json({
      error:
        "Failed to connect to AI",
    });
  }
});


// =========================
// SPEECH AUTO-FORMATTING
// =========================

app.post('/format-speech', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Speech text is required",
      });
    }

    const result = await model.generateContent({
      systemInstruction: `
You are a multilingual speech transcription formatter.

Your job is to convert a raw speech-to-text transcript into natural written text.

Supported languages:
- English
- Hindi
- Assamese

Rules:
- Preserve the user's actual meaning.
- Do not add information that was not spoken.
- Do not remove meaningful words.
- Detect whether the transcript represents English, Hindi, or Assamese.
- If the transcript is Hindi written in Latin/English letters, convert it to natural Hindi Devanagari script.
- If the transcript is Assamese written in Latin/English letters, convert it to natural Assamese Assamese script.
- If the transcript is already written in the correct script, preserve that script.
- Keep English in English.
- Correct capitalization where appropriate.
- Add natural punctuation.
- Separate sentences when the meaning clearly indicates a new sentence.
- Use question marks for questions.
- Use commas where natural.
- Do not translate Hindi into English.
- Do not translate Assamese into English.
- Do not change the user's intended meaning.
- Return ONLY the final formatted text.
`,

      contents: [
        {
          role: "user",
          parts: [
            {
              text: text.trim(),
            },
          ],
        },
      ],
    });

    const formattedText =
      result.response.text().trim();

    res.json({
      text: formattedText || text.trim(),
    });

  } catch (error) {
    console.error(
      "Speech formatting error:",
      error
    );

    res.status(500).json({
      error: "Failed to format speech",
    });
  }
});



// =========================
// SPEECH TRANSCRIPTION
// =========================

app.post("/transcribe-speech", async (req, res) => {
  try {
    const {
      audio,
      mimeType,
    } = req.body;

    if (!audio) {
      return res.status(400).json({
        error: "Audio data is required",
      });
    }

    if (!mimeType) {
      return res.status(400).json({
        error: "Audio MIME type is required",
      });
    }

    const text =
      await transcribeSpeech(
        audio,
        mimeType
      );

    res.json({
      text,
    });

  } catch (error) {
    console.error(
      "Speech transcription error:",
      error
    );

    res.status(500).json({
      error:
        "Failed to transcribe speech",
    });
  }
});




app.post("/ask-stream", async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
res.setHeader("Transfer-Encoding", "chunked");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

const words = [
  "Hello",
  " ",
  "from",
  " ",
  "Padmaria",
  "!",
];

for (const word of words) {
  res.write(word);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

res.end();

  } catch (error) {
    console.error(error);

    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));