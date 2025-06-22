// functions/index.js
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {v4: uuidv4} = require("uuid");
const cors = require("cors");
const express = require("express");
const axios = require("axios");
const {GoogleAuth} = require("google-auth-library");

admin.initializeApp();
const storage = admin.storage();

const app = express();

const allowedOrigins = [
  "http://localhost:5005",
  "https://custom3dprintbuilder.web.app",
  "https://custom3dprintbuilder.firebaseapp.com",
];

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      const msg = "The CORS policy for this site does not " +
                  "allow access from the specified Origin.";
      callback(new Error(msg), false);
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.get("/generateAiImage", async (req, res) => {
  const userPrompt = req.query.prompt || "A cute 3D character";

  const fullPrompt =
    `A 3D character of a ${userPrompt}, in the style of modern Pixar animation, sharp focus, crisp details, ` +
    "chibi proportions, joyful and expressive pose. " +
    "Flawlessly smooth surfaces with a semi-matte finish, vibrant saturated colors. " +
    "Designed as a collectible miniature figurine, optimized for 3D printing. " +
    "Bright, even, and clean studio lighting on a solid white background.";

  try {
    logger.info(`Generating image with Imagen for prompt: ${userPrompt}`);

    const project =
      process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    const location = "us-central1";
    const model = "imagegeneration@006";

    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    // --- Using the ":predict" endpoint for Imagen models ---
    const endpoint = "https://" + location + "-aiplatform.googleapis.com" +
      `/v1/projects/${project}/locations/${location}` +
      `/publishers/google/models/${model}:predict`;

    // --- Using the request body structure for Imagen models ---
    const requestBody = {
      instances: [
        {prompt: fullPrompt},
      ],
      parameters: {
        sampleCount: 1,
      },
    };

    const apiResponse = await axios.post(endpoint, requestBody, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // --- Using the response structure for Imagen models ---
    const predictions = apiResponse.data.predictions;
    if (
      !predictions ||
      predictions.length === 0 ||
      !predictions[0].bytesBase64Encoded
    ) {
      logger.error("Imagen response missing image data.", apiResponse.data);
      return res.status(502).send("The AI model did not return an image.");
    }
    const imageBase64 = predictions[0].bytesBase64Encoded;

    const bucket = storage.bucket();
    const fileName = `generated/${uuidv4()}.png`;
    const file = bucket.file(fileName);
    const buffer = Buffer.from(imageBase64, "base64");

    await file.save(buffer, {
      metadata: {contentType: "image/png"},
    });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-17-2026",
    });

    logger.info(`Image saved. Signed URL: ${signedUrl}`);
    res.send({imageUrl: signedUrl});
  } catch (error) {
    logger.error("An error occurred in the generateAiImage function.");
    if (error.response) {
      logger.error("API Error Response Data:", error.response.data);
    } else {
      logger.error("Error Message:", error.message);
    }
    return res.status(500).send("An unexpected error occurred.");
  }
});

exports.generateAiImageHttp = onRequest(
    {region: "us-central1", cors: false},
    app,
);
