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
    "When asked for a chore chart, respond ONLY with valid JSON — no extra text, no markdown, no code fences. " +
    "For home checklists, use plain text with clear sections and no markdown ## headers.";

  let userPrompt = "";

  if (type === "chore-chart") {
    const names = roommateNames;
    const n = Array.isArray(roommates) ? roommates.length : 6;

    userPrompt =
      `Generate a 12-week chore rotation chart for these ${n} roommates: ${names}.\n\n` +
      (preferences ? `USER'S HOME CONTEXT (this drives which slots you create):\n${preferences}\n\n` : "") +
      `STEP 1 — DECIDE WHICH SLOTS TO INCLUDE.\n` +
      `Each "slot" is a recurring weekly responsibility. Only include slots that correspond to chores, items, or rooms the user actually mentioned in their context above. Do NOT default to a fixed list of slots.\n\n` +
      `Examples of how to choose:\n` +
      `- If the user mentions a kitchen with multiple appliances + chores → include "kitchen_heavy" and "kitchen_light"\n` +
      `- If only a few light kitchen tasks → just one "kitchen" slot\n` +
      `- If the user has no kitchen content at all → omit kitchen slots entirely\n` +
      `- Same logic for bathroom: heavy/light split only when there's enough volume; otherwise one slot or none\n` +
      `- Add other slots if the notes reference them: "laundry", "trash", "vacuum_mop", "outdoor", "pets", "dishes", "shopping", etc.\n` +
      `- Add "ad_hoc" only if there are more roommates than slots and you need a fill-in role\n\n` +
      `Use lowercase snake_case keys (bathroom_heavy, kitchen_light, laundry, trash, vacuum_mop, ad_hoc, etc.).\n` +
      `Each slot must have a category from: "bathroom", "kitchen", "cleaning", "laundry", "outdoor", "other".\n\n` +
      `STEP 2 — ASSIGN SLOTS TO PEOPLE FOR 12 WEEKS.\n` +
      `Rotation rules:\n` +
      `- The hardest slot (whichever you pick — usually a "heavy" tier) must rotate evenly across all ${n} people; no person does it two weeks in a row.\n` +
      `- Lighter slots can repeat for the same person but shouldn't always fall to the same people.\n` +
      `- If a week has more roommates than slots, the extras rotate through "ad_hoc" or repeat lighter slots.\n` +
      `- If a week has more slots than roommates, leave the unused slot keys out of that week's assignments.\n\n` +
      `OUTPUT — respond with ONLY this JSON shape, no other text:\n` +
      `{\n` +
      `  "slots": [\n` +
      `    { "key": "bathroom_heavy", "label": "Bathroom Heavy", "category": "bathroom" },\n` +
      `    { "key": "kitchen_light", "label": "Kitchen Light", "category": "kitchen" }\n` +
      `  ],\n` +
      `  "weeks": [\n` +
      `    { "week": 1, "assignments": { "bathroom_heavy": "Name", "kitchen_light": "Name" } }\n` +
      `  ],\n` +
      `  "fairness_note": "One sentence noting how the hardest slot is distributed."\n` +
      `}\n\n` +
      `Rules: use exact first names from the list. Slot keys in "weeks" must match keys in "slots". Produce all 12 weeks.`;
  } else {
    const masterList = `
Room & Bedroom: Shower Caddy, Standing Fan / Box Fan, Room Decor (string lights, posters, pictures), Small Rug, Mirror, Towel Hook (Command Strip), Hangers, Plastic Storage Bins (under bed / top of wardrobe), Lamp, Alarm Clock, Whiteboard for Door.
Kitchen: Mini-fridge, Microwave, Trash Can, Water Filter / Brita, Hot Water Kettle, Reusable Utensil Kit, Plastic Silverware (backup), Paper Plates (backup), Tupperware, Microwave-safe Bowls, Coffee Maker, Coffee Pods, Chip Clips, Paper Towels, Dish Towel, Sponge, Dish Soap, Trash Bags, Plastic Bags, Reusable Water Bottle, Tumbler, Mug, Bottle Brush, Saran Wrap / Cling Film, Parchment Paper, Aluminium Foil, Dishwasher Pods, Air Fryer, Blender, Pans, Pots, Cutting Board, Silverware, Silverware Organizer, Oven / Baking Tray, Rice Cooker, Plates, Bowls, Toaster, Strainer / Colander, Whisk, Measuring Cups, Knives, Dish Drying Mat, Dish Drying Rack, Spatulas, Mixing Spoons, Can Opener, Bottle Opener, Tongs, Food Storage Containers, Peeler, Kitchen Scissors, Oil Dispenser.
Cleaning Supplies: Laundry Detergent, Laundry Basket, All-purpose Cleaner, Mini Vacuum, Clorox / Disinfectant Wipes, Windex / Glass Cleaner, Swiffer / Mop, Toilet Cleaner, Mirror Cleaner, Cleaning Rags, Trash Bags, Febreze / Air Freshener.
Bedding & Linens: Bath Towels, Hand Towels, Sheets, Pillowcases, Pillows, Mattress Pad / Topper, Duvet / Comforter, Throw Blanket, Lint Roller, Steamer / Iron.
Bathroom: Toilet Paper, Hand Soap, Hand Soap Refills, Shower Toiletries Holder / Caddy, Toilet Cleaner, Mirror Cleaner, Febreze, Hand Towels, Trashcan.
Utility & Misc: Batteries, Duct Tape, Painters Tape, Extension Cord, Power Strip, Lock or Lockbox, Lint Roller, Tissues, Lighter, Pocket Knife, Scissors, Calendar, Desk Drawer Organizers, Rag, Steamer / Iron.
Food Staples: Ramen, Instant Oatmeal, Chips / Crackers / Cookies, Granola Bars, Microwave Popcorn, Gum and Mints, Tea, Hot Chocolate, Coffee Pods, Soup (canned), Rice, Pasta, Tomato Sauce, Bread, Butter, Milk, Eggs, Sugar, Salt, Pepper, Oil, Cinnamon, Garlic, Ginger, Garlic Powder, Chilli Flakes, Soy Sauce, Hot Sauce, Ketchup, Honey, Nutella, Peanut Butter, Jam, Cereal, Yogurt, Frozen Veggies, Tofu, Dahl.
`;

    const hasSelections = preferences && preferences.includes("(selected):");
    const hasNotes = preferences && !preferences.includes("(selected):") && preferences.trim().length > 0;

    if (hasSelections) {
      userPrompt =
        `A group of roommates (${roommateNames}) are setting up their home. ` +
        `Here is what they have already selected or plan to get:\n${preferences}\n\n` +
        `Based on what they already have, suggest the most important items they are MISSING. ` +
        `Focus on gaps — things that are commonly needed but not yet on their list. ` +
        `Also flag any items they selected that pair well with something they forgot (e.g. they have pans but no oil). ` +
        `Organise suggestions by category: Room & Bedroom, Kitchen, Cleaning, Bathroom, Bedding, Shared Items, Utility & Misc, Food Staples. ` +
        `Only include categories where there are meaningful gaps. ` +
        `Mark each suggestion as Must-Have ✓ or Nice-to-Have ○. ` +
        `Add a brief reason why each item is useful. ` +
        `Draw from this master list for inspiration but also suggest items not on it if genuinely useful:\n${masterList}` +
        (hasNotes ? `Additional context from the roommates: ${preferences.split("(selected):").slice(-1)[0]}` : "");
    } else {
      userPrompt =
        `Create a practical, well-curated home essentials list for a group of roommates: ${roommateNames}. ` +
        (preferences ? `Context: ${preferences}. ` : "") +
        `Organise into sections: Room & Bedroom, Kitchen, Cleaning Supplies, Bathroom, Bedding & Linens, Shared Items, Utility & Misc, Food Staples. ` +
        `Mark each item as Must-Have ✓ or Nice-to-Have ○. ` +
        `Add a short note or cost estimate where helpful. ` +
        `Keep it practical and budget-friendly. Draw from this reference:\n${masterList}`;
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 3000,
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
