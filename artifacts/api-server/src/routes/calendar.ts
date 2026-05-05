// Google Calendar integration via @replit/connectors-sdk
import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();

// POST /api/calendar/add-chore
// Body: { title, dueDate, category, points }
// Creates a Google Calendar event for a chore on its due date
router.post("/calendar/add-chore", async (req, res) => {
  const { title, dueDate, category, points } = req.body as {
    title: string;
    dueDate: string;
    category?: string;
    points?: number;
  };

  if (!title || !dueDate) {
    res.status(400).json({ error: "title and dueDate are required" });
    return;
  }

  try {
    const connectors = new ReplitConnectors();

    // Build an all-day event on the due date
    const dateStr = new Date(dueDate).toISOString().split("T")[0];

    const event = {
      summary: `🏠 ${title}`,
      description: [
        `Homie chore reminder`,
        category ? `Category: ${category}` : null,
        points ? `Points: +${points}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 480 }], // 8am reminder
      },
    };

    const response = await connectors.proxy(
      "google-calendar",
      "/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ status: response.status, body: errBody }, "Google Calendar API error");
      res.status(502).json({ error: "Google Calendar API error", detail: errBody });
      return;
    }

    const created = await response.json() as { id: string; htmlLink: string };
    res.json({ success: true, eventId: created.id, link: created.htmlLink });
  } catch (err) {
    req.log.error({ err }, "Failed to create calendar event");
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

export default router;
