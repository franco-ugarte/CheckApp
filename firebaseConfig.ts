// checkapp-movil/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TUS CREDENCIALES
const firebaseConfig = {
  apiKey: "AIzaSyAV5jFAkpjSqFUC0Qo8V-1SxEDdrHFlWn4", 
  projectId: "checkapp-2b80d", 
  storageBucket: "checkapp-2b80d.firebasestorage.app", 
  appId: "1:440675224864:android:83609896adcdadf3495b45",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportación correcta y nombrada
export { db };