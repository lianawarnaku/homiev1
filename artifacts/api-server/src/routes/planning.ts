import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/planning/suggest", async (req, res) => {
  const { type, preferences, roommates } = req.body as {
    type: "chore-chart" | "home-checklist";
    preferences?: string;
    roommates?: string[];
  };

  if (!type || !["chore-chart", "home-checklist"].includes(type)) {
    res.status(400).json({ error: "Invalid type. Use chore-chart or home-checklist." });
    return;
  }

  const roommateNames =
    Array.isArray(roommates) && roommates.length > 0
      ? roommates.join(", ")
      : "the roommates";

  const systemPrompt =
    "You are a friendly and practical home management assistant helping roommates organize their shared living space. " +
    "Provide clear, well-organized, and actionable advice. " +
    "Format your response using plain text with clear sections. " +
    "Be concise but thorough. Do not use markdown headers with ##, use plain labels instead.";

  let userPrompt = "";

  if (type === "chore-chart") {
    userPrompt =
      `Create a fair and balanced weekly chore chart for: ${roommateNames}. ` +
      (preferences ? `Additional context: ${preferences}. ` : "") +
      "Include: daily tasks, weekly tasks, and monthly tasks. " +
      "Assign tasks fairly and rotate where possible. " +
      "Include estimated time for each task. " +
      "Format clearly with days of the week and clear assignments.";
  } else {
    userPrompt =
      `Create a comprehensive home essentials checklist for a new home or dorm. ` +
      (preferences ? `Context: ${preferences}. ` : "") +
      "Organize by room/category: Kitchen, Bathroom, Bedroom, Living Room, Cleaning Supplies, Laundry. " +
      "Mark each item as Must-Have or Nice-to-Have. " +
      "Include estimated cost ranges where relevant. " +
      "Keep it practical and budget-friendly.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const suggestion =
      completion.choices[0]?.message?.content ??
      "Unable to generate suggestion. Please try again.";

    res.json({ suggestion });
  } catch (err) {
    req.log.error({ err }, "Planning suggestion failed");
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

export default router;
