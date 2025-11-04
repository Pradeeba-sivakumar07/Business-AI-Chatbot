// Minimal Express server with optional OpenAI integration and rule-based fallback
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Simple rule-based fallback for business enquiries
function fallbackReply(message) {
  const m = message.toLowerCase();
  if (m.includes('price') || m.includes('cost') || m.includes('pricing')) {
    return "Our pricing depends on the plan and volume. Typical starting price is $99/month. Would you like a custom quote?";
  }
  if (m.includes('demo') || m.includes('trial') || m.includes('show')) {
    return "We can schedule a demo. Please share your preferred date/time and timezone or provide an email to contact.";
  }
  if (m.includes('product') || m.includes('features') || m.includes('what is')) {
    return "Our product is a scalable video processing platform supporting MXF OP-Atom DNxHR and many other codecs. Which product or feature would you like details on?";
  }
  if (m.includes('support') || m.includes('issue') || m.includes('help')) {
    return "For support, please provide your order number or system logs. Alternatively, email support@yourcompany.com.";
  }
  if (m.includes('contact') || m.includes('sales') || m.includes('reach')) {
    return "You can reach our sales team at sales@yourcompany.com or call +1-555-123-4567.";
  }
  return "Thanks for reaching out — could you tell me a bit more? For example: 'Tell me about product X', 'Pricing', or 'Schedule a demo'.";
}

// Call OpenAI if OPENAI_API_KEY provided
async function callOpenAI(message) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini", // placeholder; change as appropriate
    messages: [
      {role: "system", content: "You are a helpful assistant for a B2B video technology company. Provide concise, professional answers about products, pricing, demos and integrations."},
      {role: "user", content: message}
    ],
    max_tokens: 500,
    temperature: 0.2
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${txt}`);
  }
  const j = await resp.json();
  // compatibility: response.choices[0].message.content
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content ? j.choices[0].message.content.trim() : JSON.stringify(j);
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message required" });

  // Try OpenAI first if key present, else fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const reply = await callOpenAI(message);
      return res.json({ reply, source: "openai" });
    } catch (err) {
      console.error("OpenAI failed:", err.message);
      const fallback = fallbackReply(message);
      return res.json({ reply: fallback, source: "fallback", error: err.message });
    }
  } else {
    const fallback = fallbackReply(message);
    return res.json({ reply: fallback, source: "fallback" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
