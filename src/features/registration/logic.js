export const VALID_CUISINES = [
  "italian",
  "mexican",
  "chinese",
  "japanese",
  "indian",
  "thai",
  "mediterranean",
  "american",
  "french",
  "korean",
  "greek",
  "vietnamese",
];

export const VALID_MEALS_PER_WEEK = ["1-3", "4-7", "8-14", "15+"];
export const VALID_COOKING_SKILLS = ["beginner", "intermediate", "advanced", "chef"];
export const VALID_HOUSEHOLD_SIZES = ["1", "2", "3-4", "5+"];
export const VALID_DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "keto",
  "halal",
  "kosher",
];
export const VALID_BUDGET_OPTIONS = ["budget", "moderate", "flexible", "premium"];

export const DUPLICATE_EMAIL_MESSAGE = "This email is already registered. Please sign in instead.";
export const GENERIC_REGISTRATION_ERROR_MESSAGE = "Could not create account. Please try again.";

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  const safePassword = password || "";
  const hasMinLength = safePassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(safePassword);
  const hasNumber = /[0-9]/.test(safePassword);

  return {
    hasMinLength,
    hasUppercase,
    hasNumber,
    isValid: hasMinLength && hasUppercase && hasNumber,
  };
}

export function passwordsMatch(password, confirmPassword) {
  return (password || "") === (confirmPassword || "");
}

export function validateStep1(fields) {
  const errors = [];
  const { firstName, lastName, email, password, confirmPassword } = fields;

  if (!firstName || firstName.trim() === "") errors.push("firstName");
  if (!lastName || lastName.trim() === "") errors.push("lastName");
  if (!email || !isValidEmail(email)) errors.push("email");

  if (!validatePassword(password).isValid) errors.push("password");
  if (!passwordsMatch(password, confirmPassword)) errors.push("confirmPassword");

  return errors;
}

export function validateCuisineSelection(selectedCuisines) {
  return Array.isArray(selectedCuisines) && selectedCuisines.length >= 3;
}

export function computeDotStates(targetStep) {
  const dots = [1, 2, 3].map((dotIndex) => {
    if (dotIndex < targetStep) return "completed";
    if (dotIndex === targetStep) return "active";
    return "pending";
  });
  return { dot1: dots[0], dot2: dots[1], dot3: dots[2] };
}

export async function registerAndFinalize({
  formData,
  register,
  setCurrentUser,
  storage,
  redirect,
}) {
  const user = await register(formData);
  setCurrentUser(user);

  const token = user?.token || user?.uid || "";
  if (token) storage.setItem("tender_token", token);
  redirect("/dashboard.html");

  return user;
}

export function mapRegistrationErrorMessage(errorMessage = "") {
  const msg = errorMessage.toLowerCase();
  if (
    msg.includes("already-in-use") ||
    msg.includes("already in use") ||
    msg.includes("already registered")
  ) {
    return DUPLICATE_EMAIL_MESSAGE;
  }
  if (msg.includes("network-request-failed") || msg.includes("network error")) {
    return "Network error — check your connection and try again.";
  }
  if (msg.includes("weak-password")) {
    return "Password is too weak — use at least 8 characters with a number and uppercase letter.";
  }
  if (msg.includes("too-many-requests")) {
    return "Too many attempts — please wait a moment and try again.";
  }
  if (msg.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("operation-not-allowed")) {
    return "Email sign-up is not enabled — please contact support.";
  }
  if (msg.includes("missing or insufficient permissions") || msg.includes("permission-denied")) {
    return "Account created but profile save failed — please sign in and update your profile.";
  }
  return GENERIC_REGISTRATION_ERROR_MESSAGE;
}
