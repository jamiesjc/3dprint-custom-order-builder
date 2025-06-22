# CustomForge 3D: A 3D Print Custom Order Builder

Welcome to CustomForge 3D, a full-stack web application designed to provide a seamless experience for customers ordering custom 3D printed products. The platform features dynamic product configurators, real-time quoting, user accounts, and an AI-powered design generator.

*(TODO: Add demo)*
<!-- ![App Demo GIF](image link) -->

---

## ✨ Key Features

* **Dynamic Product Configurators:** Users can browse multiple product lines (e.g., "Custom Bufo," "Team Swag") and select from various types, sizes, colors, and add-ons.
* **Real-time Quoting:** All pricing, material usage, and time estimates update instantly on the client-side as the user changes their selections, powered by Firestore's `onSnapshot` real-time listeners.
* **AI-Powered Design Generation:** An "AI-Generated Custom Character" page allows users to enter a text prompt, which securely calls a Cloud Function to generate a unique concept image using Google's Vertex AI (Imagen model).
* **User Authentication & Saved History:** Users can create an account and log in using Firebase Authentication. All saved quotes are tied to their user ID and displayed in a real-time "Quote History" section on each product page.
* **Direct File Uploads:** For custom logo or design work, users can upload multiple images directly from the product page, which are securely stored in Cloud Storage.
* **Stateful UI:** User selections are preserved even when product data (like prices) is updated in real-time by an administrator, providing a smooth and non-disruptive user experience.

---

## 🛠️ Tech Stack & Architecture

This project is built on the Firebase ecosystem, leveraging its powerful integration to create a full-stack application with a serverless backend.

* **Frontend:** Plain HTML, CSS, JavaScript
* **Backend & Services:**
    * **Firebase Hosting:** Hosts the static web application with a global CDN and free SSL.
    * **Firebase Authentication:** Handles secure user sign-up, sign-in, and session management.
    * **Firestore:** A NoSQL, real-time database that serves as the single source of truth for all product, quote, and order data.
    * **Cloud Functions (2nd Gen):** Provides a secure, serverless backend (`onRequest` trigger) for running the AI image generation logic.
    * **Cloud Storage:** Stores all user-uploaded design files and AI-generated images.
* **Third-Party APIs:**
    * **Google Vertex AI (Imagen):** The AI model used for generating images from text prompts.
    * **EmailJS:** Handles the client-side submission of order details via email.

#### System Architecture
```
+-----------+      +-------------------+      +-------------------------+
|           |----->|                   |----->|   Firebase Services     |
|   User    |      |  Firebase Hosting |      | - Authentication        |
|           |<-----| (Web App: HTML/JS)|<-----| - Firestore (Real-time) |
+-----------+      +-------------------+      | - Cloud Storage         |
                          |                   +-------------------------+
                          |
                          v
        +----------------------------------------+
        |  Cloud Function (v2 - onRequest trigger)  |
        |  (generateAiImage)                     |
        |                  |                     |
        |                  v                     |
        |             +-----------+              |
        |             | Vertex AI |              |
        |             | (Imagen)  |              |
        |             +-----------+              |
        +----------------------------------------+

```

---

## 🚀 Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

* Node.js (v20 or later recommended)
* Firebase CLI (`npm install -g firebase-tools`)
* A Firebase project with the **Blaze (Pay-as-you-go)** plan enabled (required for Cloud Functions and Vertex AI).

### 1. Firebase Project Setup

1.  **Clone the repo:**
    ```sh
    git clone [https://github.com/jamiesjc/3dprint-custom-order-builder.git](https://github.com/jamiesjc/3dprint-custom-order-builder.git)
    cd 3dprint-custom-order-builder
    ```
2.  **Create a Firebase Project:** Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
3.  **Connect Your Local Project:** Run `firebase use --add`, select your new project, and give it an alias (e.g., `default`).
4.  **Register a Web App:** In your Firebase project settings, add a new Web App. Firebase will give you a `firebaseConfig` object.
5.  **Create `firebase-config.js`:** In the `public` directory, create a new file named `firebase-config.js` and paste the config object into it, like so:
    ```javascript
    // public/firebase-config.js
    const firebaseConfig = {
      apiKey: "AIza...",
      authDomain: "your-project-id.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project-id.appspot.com",
      messagingSenderId: "...",
      appId: "..."
    };
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    ```

### 2. Backend Setup (Cloud Functions)

1.  **Enable APIs:** In the Google Cloud Console for your project, make sure to **ENABLE** the **Vertex AI API**.
2.  **Set Permissions:**
    * Go to the **IAM & Admin** page.
    * Find the service account principal that ends in `@appspot.gserviceaccount.com` or something similar.
    * Grant it the **Vertex AI User** role. This allows your function to call the AI model.
3.  **Install Dependencies:** Navigate to the `functions` directory and install the required packages.
    ```sh
    cd functions
    npm install
    ```

### 3. Firestore Setup

You need to create the `products` and `addOns` collections in Firestore with the data for your application. Create documents like `products/bufo`, `products/team-swag`, etc.

### 4. Run Locally (Recommended)

Use the Firebase Emulators to test your entire application locally before deploying.
```sh
firebase emulators:start

This will host your website locally (e.g., at http://localhost:5005) and run a local version of your Cloud Function.

5. Deploy to the Cloud
When you're ready to go live, run the deploy command from the project's root directory:

firebase deploy

This will deploy your website to Firebase Hosting and your function to Cloud Functions. The CLI will output your live website URL.
