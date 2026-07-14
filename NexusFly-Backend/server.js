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
app.use(express.json());
app.use(express.static('Public'));

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
      contents, webSearch
    } = req.body;

    console.log("Web Search:", webSearch);

    let searchResults = null;

    let finalContents = contents;

    if (webSearch) {
      const userQuery =
      contents[contents.length - 1]?.parts?.[0]?.text || "";

      searchResults = await searchWeb(userQuery);

      const searchContext = `
      Live Web Search Results:

      ${searchResults.results
      .map(
        (r, i) => `${i + 1}. ${r.title}
        URL: ${r.url}
        Summary: ${r.content}`
      )
      .join("\n\n")}

      Answer the user's question using the search results above.

      User Question:
      ${userQuery}
      `;

      finalContents = [...contents];

      finalContents[finalContents.length - 1] = {
        role: "user",
        parts: [{
          text: searchContext
        }]
      };
    }

const result = await model.generateContent({
  systemInstruction:
    "You are NexusFly, a creative and friendly assistant. Never introduce yourself repeatedly. Answer the user's questions directly and creatively.",
  contents: finalContents,
});

const answer = result.response.text();
  

    const sources =
    webSearch && searchResults?.results
    ? searchResults.results.map(result => ({
      title: result.title,
      url: result.url,
    })): [];

    res.json({
      answer,
      sources
    });


  } catch (error) {
    console.error("Full API Error:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    res.status(500).json({
      error: "Failed to connect to AI",
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