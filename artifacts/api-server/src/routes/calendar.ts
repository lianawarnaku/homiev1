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

// GET /api/calendar/availability?weekStart=YYYY-MM-DD
// Returns the current user's busy time slots for the week from Google Calendar
router.get("/calendar/availability", async (req, res) => {
  const weekStart = req.query.weekStart as string | undefined;
  if (!weekStart) {
    res.status(400).json({ error: "weekStart is required" });
    return;
  }

  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy(
      "google-calendar",
      "/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          items: [{ id: "primary" }],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ status: response.status, body: errBody }, "FreeBusy API error");
      res.status(502).json({ error: "Google Calendar API error", detail: errBody });
      return;
    }

    const data = (await response.json()) as {
      calendars: { primary: { busy: Array<{ start: string; end: string }> } };
    };

    const busySlots = data.calendars?.primary?.busy ?? [];
    const busyDays = new Set<string>();
    for (const slot of busySlots) {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      const d = new Date(slotStart);
      d.setHours(0, 0, 0, 0);
      while (d < slotEnd) {
        busyDays.add(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }

    res.json({ busyDays: [...busyDays], connected: true });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch availability");
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

export default router;
