import { GoogleGenAI, Type, Schema, Modality, ThinkingLevel } from "@google/genai";
import { Question } from '../types';

// Helper to get AI instance dynamically
const getAI = (apiKey: string) => {
  if (!apiKey) throw new Error("Vui lòng nhập Google Gemini API Key để bắt đầu.");
  return new GoogleGenAI({ apiKey });
};

const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "Nội dung câu hỏi trắc nghiệm Lịch sử bằng tiếng Việt.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách 4 lựa chọn trả lời.",
    },
    correctAnswerIndex: {
      type: Type.INTEGER,
      description: "Chỉ số của câu trả lời đúng trong mảng options (0-3).",
    },
    explanation: {
      type: Type.STRING,
      description: "Giải thích ngắn gọn tại sao đáp án đó đúng.",
    },
    hint: {
      type: Type.STRING,
      description: "Một gợi ý ngắn gọn, không lộ đáp án trực tiếp, giúp người chơi suy luận lại nếu chọn sai.",
    },
    funFact: {
      type: Type.STRING,
      description: "Một sự thật lịch sử thú vị hoặc bối cảnh mở rộng liên quan đến câu hỏi này (Did you know?).",
    }
  },
  required: ["question", "options", "correctAnswerIndex", "explanation", "hint", "funFact"],
};

export const generateQuestion = async (apiKey: string, topic: string, difficulty: number, grade: string): Promise<Question> => {
  try {
    const ai = getAI(apiKey);
    const difficultyText = [
      "Rất dễ", "Dễ", "Trung bình", "Khá khó", "Khó", "Rất khó"
    ][difficulty - 1];

    const prompt = `
      Bạn là giáo viên Lịch sử. Tạo 1 câu hỏi trắc nghiệm JSON tiếng Việt.
      - Chủ đề: "${topic}"
      - Lớp: ${grade}
      - Độ khó: ${difficulty}/6
    `;

    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        // Disable thinking for speed on simple/moderate questions
        thinkingConfig: difficulty <= 4 ? { thinkingBudget: 0 } : undefined, 
        systemInstruction: "Trả về JSON câu hỏi lịch sử chính xác."
      },
    });

    let textOutput = textResponse.text || "";
    textOutput = textOutput.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    const json = JSON.parse(textOutput);
    
    // Note: Image is NO LONGER generated here to speed up initial response time.
    // It will be handled asynchronously in the UI.
    
    return {
      text: json.question,
      options: json.options,
      correctAnswerIndex: json.correctAnswerIndex,
      explanation: json.explanation,
      difficulty: difficulty,
      topic: topic,
      hint: json.hint || "Hãy đọc kỹ lại câu hỏi và các sự kiện liên quan.",
      funFact: json.funFact || "Lịch sử luôn chứa đựng những điều bất ngờ!",
      imageUrl: undefined // Will be filled later
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Không thể tạo câu hỏi lúc này.");
  }
};

export const generateImage = async (apiKey: string, prompt: string): Promise<string | undefined> => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A detailed, historical illustration for a history quiz. Topic: ${prompt}. Style: Realistic, educational, clear subject.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  } catch (error) {
    console.error("Image generation failed:", error);
    return undefined;
  }
};

export const generateSpeechFromText = async (apiKey: string, text: string): Promise<string | undefined> => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Speech generation failed:", error);
    return undefined;
  }
};