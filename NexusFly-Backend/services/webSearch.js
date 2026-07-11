const { tavily } = require("@tavily/core");

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function searchWeb(query) {
  const response = await tvly.search(query, {
    searchDepth: "basic",
    maxResults: 5,
    includeAnswer: true,
  });

  return response;
}

module.exports = { searchWeb };