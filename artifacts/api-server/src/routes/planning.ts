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
    const referenceList = `
REFERENCE ITEM LIST (draw from these when relevant — do not just copy paste, curate and organise thoughtfully):

Room / Dorm Essentials: Shower Caddy, Standing Fan / Box Fan, Room Decor (string lights, posters, pictures), Small Rug, Mirror, Towel Hook (command strip), Hangers, Plastic Storage Bins (under bed / top of wardrobe), Lamp, Alarm Clock, Whiteboard for Door, Key Nostalgic Items.

Kitchen: Water Filter / Brita, Hot Water Kettle, Reusable Utensil Kit, Plastic Silverware (backup), Paper Plates (backup), Tupperware, Microwave-safe Bowls, Coffee Maker, Coffee Pods, Chip Clips, Paper Towels, Dish Towel, Dish Towels, Sponge, Dish Soap, Trash Bags, Plastic Bags, Reusable Water Bottle, Tumbler, Mug, Mugs, Cups, Bottle Brush, Saran Wrap / Cling Film, Parchment Paper, Aluminium Foil, Dishwasher Pods, Air Fryer, Blender, Pans, Pots, Cutting Board, Silverware, Silverware Organizer, Oven / Baking Tray, Rice Cooker, Plates, Bowls, Toaster, Strainer / Colander, Whisk, Measuring Cups, Knives, Dish Drying Mat, Dish Drying Stand / Rack, Spatulas, Mixing Spoons, Can Opener, Bottle Opener, Tongs, Food Storage Containers, Peeler, Kitchen Scissors, Oil Dispenser.

Cleaning Supplies: Laundry Detergent, Laundry Basket, All-purpose Cleaner, Mini Vacuum, Clorox / Disinfectant Wipes, Windex / Glass Cleaner, Swiffer / Mop, Toilet Cleaner, Mirror Cleaner, Cleaning Rags, Trash Bags, Febreze / Air Freshener.

Potentially Shared with Roommates: Mini-fridge, Microwave, Trash Can, Rice Cooker, Air Fryer, Blender, Coffee Maker.

Bedding / Linens: Bath Towels, Hand Towels, Sheets, Pillowcases, Pillows, Mattress Pad / Topper, Duvet / Comforter, Throw Blanket, Lint Roller, Steamer / Iron.

Bathroom: Toilet Paper, Hand Soap, Hand Soap Refills, Shower Toiletries Holder / Caddy, Toilet Cleaner, Mirror Cleaner, Febreze, Hand Towels, Trashcan.

Utility / Misc: Batteries, Duct Tape, Painters Tape, Extension Cord, Power Strip, Lock or Lockbox, Lint Roller, Tissues, Lighter, Pocket Knife, Scissors, Calendar, Desk Drawer Organizers, Rag, Steamer / Iron.

Food Staples: Ramen, Instant Oatmeal, Chips / Crackers / Cookies, Granola Bars, Microwave Popcorn, Gum and Mints, Tea, Hot Chocolate, Coffee Pods, Soup (canned), Rice, Pasta, Tomato Sauce, Bread, Butter, Milk, Eggs, Sugar, Salt, Pepper, Oil, Cinnamon, Garlic, Ginger, Garlic Powder, Chilli Flakes, Soy Sauce, Hot Sauce, Ketchup, Honey, Nutella, Peanut Butter, Jam, Cereal, Yogurt, Frozen Veggies, Tofu, Dahl.
`;

    userPrompt =
      `Create a comprehensive, well-curated home essentials checklist for a new home or dorm room. ` +
      (preferences ? `Context: ${preferences}. ` : "") +
      "Use the following reference list as your primary source — select, prioritise and organise the most relevant items rather than listing everything: " +
      referenceList +
      "Organise your output into clear sections: Room & Bedroom, Kitchen, Bathroom, Cleaning Supplies, Bedding & Linens, Shared / Communal Items, Utility & Misc, Food Staples. " +
      "Mark each item as Must-Have ✓ or Nice-to-Have ○. " +
      "Add a short note or estimated cost range for items where it's helpful. " +
      "Keep it practical, budget-friendly, and tailored to roommate living.";
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
