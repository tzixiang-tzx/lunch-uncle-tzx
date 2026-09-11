import ui from "./ui.html";
import { runLoop } from "./loop.js";

// The browser replays the whole conversation on every turn, so cap what we
// forward to the model.
const MAX_HISTORY_TURNS = 20;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/") {
      return new Response(ui, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "POST" && pathname === "/chat") {
      return handleChat(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const { history, message } = body;
  if (typeof message !== "string" || message.trim() === "") {
    return json({ error: "message is required" }, 400);
  }

  try {
    const reply = await runLoop(sanitiseHistory(history), message, env);
    return json({ reply });
  } catch (err) {
    console.error("chat failed:", err);
    return json({ error: "Uncle cannot think right now, try again later." }, 500);
  }
}

/**
 * Keep only well-formed user and assistant turns from client-supplied history.
 *
 * runLoop spreads this straight into the model's message list, so an unchecked
 * value is two problems: anything that is not iterable throws and turns the
 * turn into a 500, and a caller can inject their own system messages to talk
 * Uncle out of his persona and tool rules. Dropping unknown roles and extra
 * keys leaves only the shape the endpoint documents.
 */
function sanitiseHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    )
    .slice(-MAX_HISTORY_TURNS)
    .map(({ role, content }) => ({ role, content }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
