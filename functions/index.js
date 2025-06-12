// functions/index.js
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
// const {VertexAI} = require("@google-cloud/vertexai");
const {v4: uuidv4} = require("uuid"); // To generate unique filenames
const cors = require("cors");
const express = require("express");
const axios = require("axios"); // For making REST calls to Vertex AI
const {GoogleAuth} = require("google-auth-library");

// Initialize Firebase Admin SDK
admin.initializeApp();
const storage = admin.storage();

const app = express();

// Configure CORS options
const corsOptions = {
  origin: "http://localhost:5005", // Allow requests from your local dev server
  methods: ["GET", "POST", "OPTIONS"], // Explicitly allow methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allow client headers
  optionsSuccessStatus: 204, // Standard for OPTIONS preflight
};

// Use CORS middleware for all routes in the Express app
app.use(cors(corsOptions));

// Your HTTP endpoint
app.get("/generateAiImage", async (req, res) => {
  // Example: Check for Authorization header if you're sending one
  // const authHeader = req.headers.authorization;
  // if (!authHeader) {
  //   return res.status(401).send("Unauthorized");
  // }

  const userPrompt = req.query.prompt || "A cute 3D character";
  const fullPrompt =
    "A photorealistic 3D render of a single, cute, " +
    `cartoon character: "${userPrompt}". ` +
    "Clean white studio background.";

  try {
    logger.info(`Generating image for prompt: ${fullPrompt}`);

    const project =
      process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    const location = "us-central1";
    const model = "imagegeneration@002"; // Common model name for Imagen

    // Get an auth token for the Vertex AI API call
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

    const apiResponse = await axios.post(
        endpoint,
        {
          instances: [
            {prompt: fullPrompt},
          ],
          parameters: {
            sampleCount: 1,
          // You can add more parameters like aspectRatio, storageUri, etc.
          },
        },
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
    );

    const predictions = apiResponse.data.predictions;
    if (
      !predictions ||
      predictions.length === 0 ||
      !predictions[0].bytesBase64Encoded
    ) {
      logger.error(
          "Vertex AI response missing expected image data:",
          apiResponse.data,
      );
      return res.status(404)
          .send("The model did not return any image candidates.");
    }
    const imageBase64 = predictions[0].bytesBase64Encoded;

    // --- Save the generated image to Cloud Storage ---
    const bucket = storage.bucket(); // Your default Cloud Storage bucket
    const fileName = `generated/${uuidv4()}.png`;
    const file = bucket.file(fileName);
    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, {
      metadata: {contentType: "image/png"},
    });
    // await file.makePublic();
    const publicUrl = file.publicUrl();
    logger.info(`Image saved to: ${publicUrl}`);

    res.send({imageUrl: publicUrl});
  } catch (error) {
    logger.error(
        "Error calling Vertex AI or saving to storage:",
        error.response ? error.response.data : error.message,
    );
    const errorMessage =
      "Failed to generate image. " +
      `Please check the function logs. ${error.message}`;
    return res.status(500).send(errorMessage);
  }
});

// Export the Express app as a standard HTTP function
// Set cors: false in options because Express handles CORS internally
exports.generateAiImageHttp = onRequest(
    {region: "us-central1", cors: false},
    app,
);
