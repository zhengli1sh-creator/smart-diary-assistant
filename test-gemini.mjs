import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyClsa6Ll4MBaxYf6RTQPCOLpc5FDQIqJ-g' });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: '你好',
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.error("Failed:", e);
  }
}

run();
