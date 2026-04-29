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
    type: {
      type: Type.STRING,
      description: "Loại câu hỏi: 'multiple-choice' (trắc nghiệm) hoặc 'essay' (tự luận).",
    },
    question: {
      type: Type.STRING,
      description: "Nội dung câu hỏi Lịch sử bằng tiếng Việt.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách 4 lựa chọn trả lời (chỉ dành cho trắc nghiệm). Để trống nếu là tự luận.",
    },
    correctAnswerIndex: {
      type: Type.INTEGER,
      description: "Chỉ số của câu trả lời đúng trong mảng options (0-3) (chỉ dành cho trắc nghiệm).",
    },
    sampleAnswer: {
      type: Type.STRING,
      description: "Câu trả lời mẫu hoặc các ý chính cần có (chỉ dành cho tự luận).",
    },
    explanation: {
      type: Type.STRING,
      description: "Giải thích ngắn gọn tại sao đáp án đó đúng hoặc giải thích cho câu hỏi tự luận.",
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
  required: ["type", "question", "explanation", "hint", "funFact"],
};

export const generateQuestion = async (apiKey: string, topic: string, difficulty: number, grade: string): Promise<Question> => {
  try {
    const ai = getAI(apiKey);
    const difficultyText = [
      "Rất dễ", "Dễ", "Trung bình", "Khá khó", "Khó", "Rất khó"
    ][difficulty - 1];

    // Increase probability of essay questions (e.g., 75% chance)
    const targetType = Math.random() < 0.75 ? 'essay' : 'multiple-choice';
    const typeInstruction = targetType === 'essay' 
      ? "Tạo câu hỏi TỰ LUẬN (essay)." 
      : "Tạo câu hỏi TRẮC NGHIỆM (multiple-choice).";

    const prompt = `
      Bạn là giáo viên Lịch sử. Tạo 1 câu hỏi JSON tiếng Việt.
      ${typeInstruction}
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
        thinkingConfig: difficulty <= 4 ? { thinkingBudget: 0 } : undefined, 
        systemInstruction: "Trả về JSON câu hỏi lịch sử chính xác."
      },
    });

    let textOutput = textResponse.text || "";
    textOutput = textOutput.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    const json = JSON.parse(textOutput);
    
    return {
      type: json.type === 'essay' ? 'essay' : 'multiple-choice',
      text: json.question,
      options: json.options,
      correctAnswerIndex: json.correctAnswerIndex,
      sampleAnswer: json.sampleAnswer,
      explanation: json.explanation,
      difficulty: difficulty,
      topic: topic,
      hint: json.hint || "Hãy đọc kỹ lại câu hỏi và các sự kiện liên quan.",
      funFact: json.funFact || "Lịch sử luôn chứa đựng những điều bất ngờ!",
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = error.message || "Không thể tạo câu hỏi lúc này.";
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error && parsed.error.message) {
        errorMessage = parsed.error.message;
      }
    } catch (e) {}

    if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
      errorMessage = "API Key không hợp lệ. Vui lòng kiểm tra lại.";
    } else if (errorMessage.includes("leaked") || errorMessage.includes("PERMISSION_DENIED")) {
      errorMessage = "API Key đã bị vô hiệu hóa hoặc bị lộ. Vui lòng tạo khóa mới.";
    } else if (errorMessage.includes("fetch failed")) {
      errorMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra lại wifi/3g.";
    }
    
    throw new Error(errorMessage);
  }
};

export const evaluateEssay = async (apiKey: string, question: Question, studentAnswer: string) => {
  try {
    const ai = getAI(apiKey);
    const prompt = `
      Bạn là giáo viên Lịch sử. Hãy chấm điểm câu trả lời tự luận của học sinh.
      Câu hỏi: ${question.text}
      Đáp án mẫu: ${question.sampleAnswer || question.explanation}
      Câu trả lời của học sinh: ${studentAnswer}
      
      Hãy đánh giá xem câu trả lời của học sinh có đạt yêu cầu không (đúng ý chính).
    `;
    
    const evaluationSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        isCorrect: { type: Type.BOOLEAN, description: "Đánh giá xem học sinh có trả lời đúng/đạt yêu cầu không" },
        feedback: { type: Type.STRING, description: "Nhận xét ngắn gọn về câu trả lời của học sinh" },
      },
      required: ["isCorrect", "feedback"]
    };

    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
        systemInstruction: "Đánh giá công tâm, khuyến khích học sinh."
      },
    });

    let textOutput = textResponse.text || "";
    textOutput = textOutput.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    return JSON.parse(textOutput) as { isCorrect: boolean, feedback: string };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = error.message || "Không thể chấm điểm lúc này.";
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error && parsed.error.message) {
        errorMessage = parsed.error.message;
      }
    } catch (e) {}

    if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
      errorMessage = "API Key không hợp lệ. Vui lòng kiểm tra lại.";
    } else if (errorMessage.includes("leaked") || errorMessage.includes("PERMISSION_DENIED")) {
      errorMessage = "API Key đã bị vô hiệu hóa hoặc bị lộ. Vui lòng tạo khóa mới.";
    } else if (errorMessage.includes("fetch failed")) {
      errorMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra lại wifi/3g.";
    }
    
    throw new Error(errorMessage);
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