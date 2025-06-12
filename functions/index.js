// functions/index.js (Gemini/Imagen Version)

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {VertexAI} = require("@google-cloud/vertexai");
const {v4: uuidv4} = require("uuid"); // To generate unique filenames

// Initialize Firebase Admin SDK
admin.initializeApp();
const storage = admin.storage();

// Initialize Vertex AI.
// The constructor uses your project's service account credentials
// automatically.
const vertexAi = new VertexAI({
  project: process.env.GCLOUD_PROJECT,
  location: "us-central1",
});

const generativeModel = vertexAi.getGenerativeModel({
  model: "imagegeneration@0.0.2", // The official model for Imagen
});

// Use the 2nd Gen onCall trigger
exports.generateAiImage = onCall({region: "us-central1"}, async (request) => {
  // The 'context' object is now part of the 'request' object in v2.
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "You must be logged in to generate an image.",
    );
  }

  // The 'data' object is also part of the 'request' object.
  const userPrompt = request.data.prompt || "A cute 3D character";
  const fullPrompt =
    "A photorealistic 3D render of a single, cute, " +
    `cartoon character: "${userPrompt}". Clean white studio background.`;

  try {
    logger.info(`Generating image for prompt: ${fullPrompt}`);

    const requestPayload = {
      contents: [{role: "user", parts: [{text: fullPrompt}]}],
    };

    const resp = await generativeModel.generateContent(requestPayload);

    if (!resp.response.candidates || resp.response.candidates.length === 0) {
      throw new HttpsError(
          "not-found",
          "The model did not return any candidates.",
      );
    }

    const firstCandidate = resp.response.candidates[0];
    const imageBase64 = firstCandidate.content.parts[0].fileData.data;

    // --- Save the generated image to Cloud Storage ---
    const bucket = storage.bucket(); // Your default Cloud Storage bucket
    const fileName = `generated/${uuidv4()}.png`;
    const file = bucket.file(fileName);

    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, {
      metadata: {
        contentType: "image/png",
      },
    });

    // Make the file public so it can be viewed in the browser
    await file.makePublic();

    const publicUrl = file.publicUrl();
    logger.info(`Image saved to: ${publicUrl}`);

    // Return the public URL of the image
    return {imageUrl: publicUrl};
  } catch (error) {
    logger.error("Error calling Vertex AI or saving to storage:", error);
    // Throw a standard HttpsError
    throw new HttpsError(
        "internal",
        "Failed to generate image. Please check the function logs.",
        error.message,
    );
  }
});
