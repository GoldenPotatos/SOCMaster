import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const CAVEMAN_PREFIX = "CAVEMAN MODE. No preamble. No pleasantries. Remove articles (a, an, the). Keep technical terms, code, and CVE IDs exact. Use fragments. Save token. Save money. Give info. Stop.\n\n";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { title, url } = await req.json();

    if (!title && !url) {
      return NextResponse.json({ error: "title or url required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = CAVEMAN_PREFIX + `You are a Cyber Threat Intelligence analyst. Extract structured intel from news articles.`;

    const userPrompt = `Analyze this cybersecurity article and respond in EXACTLY this format with no deviations:

SUMMARY: [Exactly 2 sentences summarizing the threat/event]

IOCs: [List all Indicators of Compromise found — IPs, domains, file hashes, CVE IDs, malware names. If none found, write "None identified."]

Article Title: ${title}
Article URL: ${url}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      }
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Intel API Error:", error);
    return NextResponse.json(
      { error: `Intel extraction failed: ${error.message}` },
      { status: 500 }
    );
  }
}
