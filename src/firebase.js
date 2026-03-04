import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB88PG-Z-IGMdmIoHfiNBdaIfAFGN13nTU",
  authDomain: "tender-a7367.firebaseapp.com",
  projectId: "tender-a7367",
  storageBucket: "tender-a7367.firebasestorage.app",
  messagingSenderId: "409916286272",
  appId: "1:409916286272:web:51dd3d4755fae4a72206a5",
  measurementId: "G-WB3D56S29S"
};

const app = initializeApp(firebaseConfig);

export { app };
