require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const {
  searchWeb
} = require("./services/webSearch");


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

    const result =
      await model.generateContent({
        systemInstruction:
          "You are NexusFly, a creative and friendly assistant. Never introduce yourself repeatedly. Answer the user's questions directly and creatively.",
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
  "NexusFly",
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