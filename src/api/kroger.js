import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase.js";

const functions = getFunctions(app);

export async function findKrogerLocation(zipCode, chain) {
  const fn = httpsCallable(functions, "findKrogerLocation");
  const result = await fn({ zipCode, chain });
  return result.data;
}

export async function getKrogerPrices(items, locationId) {
  const fn = httpsCallable(functions, "getKrogerPrices");
  const result = await fn({ items, locationId });
  return result.data;
}
