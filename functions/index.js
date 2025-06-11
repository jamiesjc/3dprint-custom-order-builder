// functions/index.js (FINAL & SECURE VERSION)

const functions = require("firebase-functions");
const {OpenAI} = require("openai");

// Initialize Admin SDK only once
const admin = require("firebase-admin");
admin.initializeApp();

// The onCall trigger automatically handles authentication and CORS
// when called from the Firebase client SDK.
exports.generateAiImage = functions.https.onCall(async (data, context) => {
  // 1. The onCall trigger automatically verifies the user's token.
  // If the user is not logged in, 'context.auth' will be null.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to generate an image.",
    );
  }

  // Initialize the client inside the function to prevent startup crashes.
  const openai = new OpenAI({
    apiKey: functions.config().openai.key,
  });

  // 'data' is the object passed from your client-side call.
  const userPrompt = data.prompt || "A cute 3D character";

  const fullPrompt =
    "A high-resolution, photorealistic 3D render " +
    "of a single, cute cartoon character based on the " +
    `description: "${userPrompt}". The character should be ` +
    "isolated on a clean, white studio background.";

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;
    console.log("Generated image URL:", imageUrl);

    // 2. Simply return the result. The SDK handles the response.
    return {imageUrl: imageUrl};
  } catch (error) {
    console.error("Error calling OpenAI API:", error.message);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to generate image. Please check the function logs.",
        error,
    );
  }
});
