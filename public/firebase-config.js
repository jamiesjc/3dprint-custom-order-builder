// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBZBfrgZU_eVYE1AiyLzcyV2v1TAo6deSA",
  authDomain: "custom3dprintbuilder.firebaseapp.com",
  projectId: "custom3dprintbuilder",
  storageBucket: "custom3dprintbuilder.firebasestorage.app",
  messagingSenderId: "153255823590",
  appId: "1:153255823590:web:b98599273ae59eefd71327",
  measurementId: "G-089K3GVFM8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);


// Get references to Firestore and Auth
const db = firebase.firestore();
const auth = firebase.auth();