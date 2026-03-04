/**
 * Gemini image edit stub for development.
 * The real Gemini client package may not be available during local dev.
 * Replace this implementation with a proper import and call when a supported
 * client is installed or when a valid CDN URL is available.
 */
export const editProfileImage = async (
  imageBase64: string,
  prompt: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  console.warn('Gemini service not available in this dev environment.');
  throw new Error('Gemini client not available. Install @google/genai or configure a working runtime URL.');
};