require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const {
  searchWeb
} = require("./services/webSearch");

app.use(cors());
app.use(express.json());
app.use(express.static('Public'));

const path = require('path');

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


    let finalContents = contents;

    if (webSearch) {
      const userQuery =
      contents[contents.length - 1]?.parts?.[0]?.text || "";

      const searchResults = await searchWeb(userQuery);

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

    const requestBody = {
      system_instruction: {
        parts: [{
          text: "You are NexusFly, a creative and friendly assistant. Never introduce yourself repeatedly. Answer the user's questions directly and creatively."
        }]
      },
      contents: finalContents
    };


    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.API_KEY}`,
      requestBody
    );

    res.json(response.data);

  } catch (error) {

    console.error(
      "Full API Error:",
      JSON.stringify(
        error.response ? error.response.data: error.message,
        null,
        2
      )
    );

    res.status(500).json({
      error: "Failed to connect to AI"
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));