import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const authForm = document.getElementById("auth-form");
const profileForm = document.getElementById("profile-form");
const logoutBtn = document.getElementById("logout-btn");
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const userEmailEl = document.getElementById("user-email");
const statusEl = document.getElementById("status");
const profileNameInput = document.getElementById("profile-name");
const profileSkillInput = document.getElementById("profile-skill");
const profileOutput = document.getElementById("profile-output");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#0b6b2a";
}

function setSignedOutUi() {
  authSection.hidden = false;
  appSection.hidden = true;
  userEmailEl.textContent = "";
  profileOutput.textContent = "No profile loaded yet.";
}

function setSignedInUi(email) {
  authSection.hidden = true;
  appSection.hidden = false;
  userEmailEl.textContent = email;
}

async function loadProfile(uid) {
  const profileRef = doc(db, "users", uid);
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    profileOutput.textContent = "No profile document yet. Save one below.";
    return;
  }

  const data = snap.data();
  profileNameInput.value = data.displayName ?? "";
  profileSkillInput.value = data.skillLevel ?? "";
  profileOutput.textContent = JSON.stringify(data, null, 2);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(authForm);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = String(formData.get("mode") ?? "login");

  if (!email || !password) {
    setStatus("Email and password are required.", true);
    return;
  }

  try {
    if (mode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
      setStatus("Account created. You are now signed in.");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    setStatus("Signed in successfully.");
  } catch (error) {
    setStatus(`Auth error: ${error.message}`, true);
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    setStatus("You must be logged in first.", true);
    return;
  }

  const profileData = {
    displayName: profileNameInput.value.trim(),
    skillLevel: profileSkillInput.value,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
    setStatus("Profile saved to Firestore.");
    await loadProfile(user.uid);
  } catch (error) {
    setStatus(`Save error: ${error.message}`, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setStatus("Signed out.");
  } catch (error) {
    setStatus(`Logout error: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setSignedOutUi();
    return;
  }

  setSignedInUi(user.email ?? "(no email)");
  try {
    await loadProfile(user.uid);
  } catch (error) {
    setStatus(`Profile load error: ${error.message}`, true);
  }
});
