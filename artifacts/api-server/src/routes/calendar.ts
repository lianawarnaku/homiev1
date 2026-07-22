// Google Calendar integration — portable (no Replit).
//
// The client obtains a Google OAuth access token (Calendar scope) via the
// standard Google sign-in flow and sends it on each request as:
//   X-Google-Access-Token: <access_token>
// We then call the Google Calendar REST API directly. This works in any
// hosting environment; there is no dependency on Replit connectors.
import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Pull the Google access token from the request, or send a 400 and return
 * null. Callers should `return` immediately when this returns null.
 */
function getGoogleToken(req: Request, res: Response): string | null {
  const token = req.header("X-Google-Access-Token");
  if (!token) {
    res.status(400).json({
      error:
        "Missing X-Google-Access-Token header. Connect Google Calendar and retry.",
    });
    return null;
  }
  return token;
}

// POST /api/calendar/add-chore
// Body: { title, dueDate, category, points }
// Creates a Google Calendar event for a chore on its due date.
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

  const googleToken = getGoogleToken(req, res);
  if (!googleToken) return;

  try {
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

    const response = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/primary/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleToken}`,
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error(
        { status: response.status, body: errBody },
        "Google Calendar API error",
      );
      // 401/403 from Google → the client's token is bad/expired; surface as 401.
      const status = response.status === 401 || response.status === 403 ? 401 : 502;
      res.status(status).json({ error: "Google Calendar API error", detail: errBody });
      return;
    }

    const created = (await response.json()) as { id: string; htmlLink: string };
    res.json({ success: true, eventId: created.id, link: created.htmlLink });
  } catch (err) {
    req.log.error({ err }, "Failed to create calendar event");
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

// GET /api/calendar/availability?weekStart=YYYY-MM-DD
// Returns the current user's busy days for the week from Google Calendar.
router.get("/calendar/availability", async (req, res) => {
  const weekStart = req.query.weekStart as string | undefined;
  if (!weekStart) {
    res.status(400).json({ error: "weekStart is required" });
    return;
  }

  const googleToken = getGoogleToken(req, res);
  if (!googleToken) return;

  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  try {
    const response = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${googleToken}`,
      },
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error(
        { status: response.status, body: errBody },
        "FreeBusy API error",
      );
      const status = response.status === 401 || response.status === 403 ? 401 : 502;
      res.status(status).json({ error: "Google Calendar API error", detail: errBody });
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
