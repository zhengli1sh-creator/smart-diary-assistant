import { google } from 'googleapis';
import { getGoogleOAuthClient } from './auth';

/**
 * Creates a new Google Doc and appends content.
 * @param userId  The authenticated user's ID
 * @param title   The title of the document
 * @param content The text content to write into the document
 * @param tokens  Optional tokens from the session
 */
export async function createGoogleDoc(
  userId: string,
  title: string,
  content: string,
  tokens?: { accessToken?: string; refreshToken?: string },
): Promise<{ documentId: string; url: string }> {
  const auth = await getGoogleOAuthClient(userId, tokens);
  const docs = google.docs({ version: 'v1', auth });

  // 1. Create the document
  const createRes = await docs.documents.create({
    requestBody: {
      title,
    },
  });

  const documentId = createRes.data.documentId;
  if (!documentId) {
    throw new Error('Failed to create document: No Document ID returned.');
  }

  // 2. Insert content
  // Note: For a new document, we insert at index 1 (just after the title/header)
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: {
              index: 1,
            },
            text: content,
          },
        },
      ],
    },
  });

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}
