import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyClsa6Ll4MBaxYf6RTQPCOLpc5FDQIqJ-g' });

async function run() {
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      console.log(model.name);
    }
  } catch (e) {
    console.error("Failed:", e);
  }
}

run();
