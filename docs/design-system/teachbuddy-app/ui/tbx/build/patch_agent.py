"""Hook the prototype's mock assistant (data/agent.js) up to the redesigned UI.

- replies come from globalThis.__tbx.agentScript when the overlay is loaded
  (tool steps, markdown answers, result cards); the original canned answer
  stays as the fallback
- references may point at questions, schedule entries or resources
- conversations can be renamed, pinned and deleted, and carry a preview line
"""
import pathlib, sys
SRC = pathlib.Path('/home/claude/build/agent.orig.js')
DST = pathlib.Path('/home/claude/teachbuddy/data/agent.js')
text = SRC.read_text()

def replace(old, new, count=1):
    global text
    found = text.count(old)
    if found != count:
        sys.exit(f'agent patch failed ({found} matches): {old[:80]!r}')
    text = text.replace(old, new)

# scripted replies
replace('''    function startReply(doc, turn, prompt) {
      const characters''', '''    function startReply(doc, turn, prompt) {
      const script = globalThis.__tbx?.agentScript;
      if (script) {
        const user = doc.messages.find((item) => item.id === turn.userMessageId);
        return script.run({ doc, turn, prompt, references: user?.references ?? [], emit, updated, finish, stamp, id: () => ctx.id(), runs: state.runs, model: turn.modelId });
      }
      const characters''')

# a preview line for the thread list once a turn ends
replace('''      for (const message of doc.messages.filter((message2) => message2.turnId === turn.id && message2.role === "assistant")) {
        message.state = stopped ? "partial" : "complete";
        emit(doc, "message", message);
      }''', '''      for (const message of doc.messages.filter((message2) => message2.turnId === turn.id && message2.role === "assistant")) {
        message.state = stopped ? "partial" : "complete";
        emit(doc, "message", message);
        const line = message.text.replace(/[#>*_`|$\\\\]/g, "").split("\\n").map((s) => s.trim()).find(Boolean);
        if (line) doc.conversation.preview = Array.from(line).slice(0, 60).join("");
      }''')

# references to questions, schedule entries and resources
replace('''        if (input.kind !== "question" || seen.has(key)) throw invalid(`/body/references/${index}`);
        seen.add(key);
        const response = await fetch(`/api/modules/questions/v2/items/${encodeURIComponent(input.id)}`);''', '''        if (!["question", "entry", "resource"].includes(input.kind) || seen.has(key)) throw invalid(`/body/references/${index}`);
        seen.add(key);
        if (input.kind !== "question") {
          const where = input.kind === "entry" ? "/api/modules/schedule/entries/" : "/api/modules/resources/items/";
          const res = await fetch(where + encodeURIComponent(input.id));
          if (!res.ok) throw workbenchFailure("not-found", 404);
          const object = await res.json();
          result.push({ input: copy(input), title: object.title || (input.kind === "entry" ? "\\u672A\\u547D\\u540D\\u4E8B\\u9879" : "\\u8D44\\u6599"), snapshot: object, capturedAt: stamp() });
          continue;
        }
        const response = await fetch(`/api/modules/questions/v2/items/${encodeURIComponent(input.id)}`);''')

# rename / pin / delete
replace('''      const doc = read(id);
      if (!action && method === "GET") return reply(doc);''', '''      const doc = read(id);
      if (!action && method === "GET") return reply(doc);
      if (!action && method === "PATCH") {
        if (typeof body?.title === "string" && body.title.trim()) doc.conversation.title = Array.from(body.title.trim()).slice(0, 80).join("");
        if (typeof body?.pinned === "boolean") doc.conversation.pinned = body.pinned;
        emit(doc, "conversation", doc.conversation);
        return reply(doc.conversation);
      }
      if (!action && method === "DELETE") {
        if (doc.turns.some((turn) => turn.state === "running")) throw agentFailure("turn-active");
        delete state.conversations[id];
        delete state.events[id];
        return ctx.json({ deleted: id }, 200);
      }''')

DST.write_text(text)
print('agent.js patched')
