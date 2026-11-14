// "Use with AI" dialog: how to connect an AI assistant to the MCP server, plus example prompts.
// Self-contained: builds its own <dialog>, needs only the opener button. No URL state.

export const MCP_URL = "https://burning-calendar.vercel.app/api/mcp";
const CLAUDE_CODE_CMD = `claude mcp add --transport http burncal ${MCP_URL}`;
const REPO = "https://github.com/MetrPikeska/burning-calendar";

/** Demo stories with verified MCP answers (docs/notes/2026-11-14-agent-demo.md). */
export const EXAMPLE_PROMPTS: readonly { prompt: string; view: string; label: string }[] = [
  {
    prompt: "Was August 2021 abnormal in Sterea Ellada (EL64), the Greek region with Evia? Compare it with the median of the preceding years and give me the map link.",
    view: "/?country=gr&region=EL64&from=2021-01&to=2021-12",
    label: "Sterea Ellada 2021",
  },
  {
    prompt: "Which Argentine province has the most fire detections per 1000 km² a year? Show the top 5.",
    view: "/?country=ar&region=34",
    label: "Formosa",
  },
  {
    prompt: "Show the 2020 fire season in Entre Ríos (Paraná Delta) month by month against the median.",
    view: "/?country=ar&region=30&from=2020-01&to=2020-12",
    label: "Entre Ríos 2020",
  },
];

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5"/></svg>`;
const CLOSE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A copyable value: the text in a <code> block and a Copy button that names what it copies. */
function copyRow(id: string, text: string, what: string): string {
  return `<div class="ai-copy">
    <code id="${id}">${escapeHtml(text)}</code>
    <button type="button" class="btn" data-copy="${id}" aria-label="Copy ${escapeHtml(what)}">${COPY_ICON}Copy</button>
  </div>`;
}

function dialogHtml(): string {
  const prompts = EXAMPLE_PROMPTS.map((p, i) => `<li>
      <p id="ai-prompt-${i}">${escapeHtml(p.prompt)}</p>
      <div class="ai-prompt-actions">
        <button type="button" class="btn" data-copy="ai-prompt-${i}" aria-label="Copy prompt ${i + 1}">${COPY_ICON}Copy prompt</button>
        <a class="btn btn-quiet" href="${p.view}">Open ${escapeHtml(p.label)} on the map</a>
      </div>
    </li>`).join("");
  return `
    <div class="ai-head">
      <h2 id="ai-title">Use with AI</h2>
      <button type="button" class="btn btn-quiet ai-close" aria-label="Close">${CLOSE_ICON}</button>
    </div>
    <div class="ai-body">
      <p class="ai-lede">Connect Claude, ChatGPT or another AI assistant to the burning calendar. It answers with our numbers, the caveats that apply and a link back to this map. The server is read-only, free and needs no key.</p>

      <h3>MCP server URL</h3>
      ${copyRow("ai-url", MCP_URL, "MCP server URL")}

      <h3>claude.ai and Claude Desktop</h3>
      <ol class="ai-steps">
        <li>Open <strong>Customize &gt; Connectors &gt; Add custom connector</strong>.</li>
        <li>Name it <em>Burning Calendar</em>, paste the URL above and save. No login is needed.</li>
        <li>Start a chat and ask one of the questions below.</li>
      </ol>
      <p class="ai-small">The Free plan allows one custom connector.</p>

      <h3>Claude Code</h3>
      ${copyRow("ai-cc", CLAUDE_CODE_CMD, "Claude Code command")}

      <h3>Other assistants</h3>
      <ul class="ai-clients">
        <li><strong>ChatGPT</strong>: add a custom MCP server (connector) with the URL above; depends on your plan.</li>
        <li><strong>Cursor</strong>: in <code>.cursor/mcp.json</code> add <code>"burncal": { "url": "${MCP_URL}" }</code> under <code>mcpServers</code>.</li>
        <li><strong>VS Code</strong>: in <code>.vscode/mcp.json</code> add <code>"burncal": { "type": "http", "url": "${MCP_URL}" }</code> under <code>servers</code>.</li>
      </ul>

      <h3>Try asking</h3>
      <ol class="ai-prompts">${prompts}</ol>

      <h3>Without MCP</h3>
      <p class="ai-small">Plain-text summary for agents: <a href="/llms.txt">/llms.txt</a>. JSON Schemas:
        <a href="/data/v1/schema/index.schema.json">index</a>,
        <a href="/data/v1/schema/region.schema.json">region</a>.
        Tool list and outputs: <a href="${REPO}/blob/main/docs/wiki/agent-access.md" target="_blank" rel="noopener">agent-access.md</a>.</p>
    </div>
    <p class="ai-status" role="status" aria-live="polite"></p>`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context and permission; fall back to a hidden textarea.
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Builds the dialog once and wires the opener. Esc and the backdrop close it; focus returns to the opener. */
export function initAgentPanel(opener: HTMLElement): void {
  const dialog = document.createElement("dialog");
  dialog.className = "ai-dialog";
  dialog.setAttribute("aria-labelledby", "ai-title");
  dialog.innerHTML = dialogHtml();
  document.body.append(dialog);

  const status = dialog.querySelector<HTMLElement>(".ai-status")!;
  let statusTimer = 0;

  opener.setAttribute("aria-haspopup", "dialog");
  opener.addEventListener("click", () => {
    dialog.showModal();
    dialog.querySelector<HTMLElement>(".ai-body")!.scrollTop = 0;
  });
  dialog.querySelector(".ai-close")!.addEventListener("click", () => dialog.close());
  // A click on the backdrop lands on the <dialog> element itself, outside its content box.
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });
  dialog.addEventListener("close", () => opener.focus());

  dialog.querySelectorAll<HTMLButtonElement>("button[data-copy]").forEach((b) => {
    const label = b.innerHTML;
    let timer = 0;
    b.addEventListener("click", async () => {
      const source = dialog.querySelector<HTMLElement>(`#${b.dataset.copy}`)!;
      const ok = await copyText(source.textContent ?? "");
      b.innerHTML = ok ? `${COPY_ICON}Copied` : `${COPY_ICON}Select and copy`;
      status.textContent = ok ? "Copied to the clipboard" : "Copy failed, select the text and copy it";
      clearTimeout(timer);
      clearTimeout(statusTimer);
      timer = window.setTimeout(() => (b.innerHTML = label), 1600);
      statusTimer = window.setTimeout(() => (status.textContent = ""), 1600);
    });
  });
}
