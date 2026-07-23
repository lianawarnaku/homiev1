// Lightweight email relay. Posts plain-text emails through Resend if a
// RESEND_API_KEY env var is configured; otherwise returns the message body
// in the response so the mobile app can fall back to "demo mode" (showing the
// confirmation/reset code in-app instead of mailing it).
import { Router } from "express";

const router = Router();

interface SendBody {
  to: string;
  subject: string;
  body: string;
}

router.post("/email/send", async (req, res) => {
  const { to, subject, body } = (req.body ?? {}) as Partial<SendBody>;

  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Homie <onboarding@resend.dev>";

  if (!apiKey) {
    req.log.info(
      { to, subject },
      "Email simulated (RESEND_API_KEY not set) — returning body for in-app display",
    );
    res.json({ sent: false, simulated: true, body });
    return;
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });

    if (!r.ok) {
      const detail = await r.text();
      req.log.error({ status: r.status, detail }, "Resend API error");
      res.status(502).json({ error: "Email send failed", detail });
      return;
    }

    res.json({ sent: true, simulated: false });
  } catch (err) {
    req.log.error({ err }, "Email send threw");
    res.status(500).json({ error: "Email send failed" });
  }
});

export default router;
