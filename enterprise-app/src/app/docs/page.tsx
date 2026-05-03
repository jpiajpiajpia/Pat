"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface ToolMeta {
  id: string;
  displayName: string;
  category: string;
}

const TOC = [
  { id: "intro", label: "What is Pat?" },
  { id: "getting-started", label: "Getting started" },
  { id: "chat-mode", label: "Chat mode" },
  { id: "code-mode", label: "Code mode" },
  { id: "attachments", label: "File attachments" },
  { id: "tools", label: "Tools reference" },
  { id: "models", label: "Models" },
  { id: "memory", label: "Memory" },
  { id: "mcp", label: "MCP servers" },
  { id: "settings", label: "Settings" },
  { id: "data", label: "Data & privacy" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function DocsPage() {
  const router = useRouter();
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("intro");

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []));
  }, []);

  // Track active section in viewport
  useEffect(() => {
    const headers = TOC.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* TOC sidebar */}
      <div
        className="w-60 border-r flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ background: "var(--pat-sidebar)", borderColor: "var(--pat-border)" }}
      >
        <div className="p-4 pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs transition-colors mb-6"
            style={{ color: "var(--pat-muted)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--pat-cream-20)" }}
            >
              <span className="font-serif text-base font-semibold" style={{ color: "var(--pat-cream)" }}>P</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--pat-text)" }}>
              Documentation
            </span>
          </div>
        </div>
        <nav className="px-2 pb-4 space-y-0.5">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={
                activeId === t.id
                  ? { background: "var(--pat-cream-10)", color: "var(--pat-text)" }
                  : { color: "var(--pat-muted)" }
              }
            >
              <ChevronRight className="h-3 w-3" />
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <article
          className="max-w-3xl mx-auto px-10 py-12 space-y-12"
          style={{ color: "var(--pat-text)" }}
        >
          <Section id="intro" title="What is Pat?">
            <p>
              Pat is a local-first AI assistant. It runs entirely on your computer — chat, code editing,
              file generation, and memory all happen on your machine, with no cloud calls. The models
              themselves are served by <Code>Ollama</Code> running locally.
            </p>
            <p>
              You can use Pat for everyday writing and reasoning (Chat mode), or for working directly on
              your code (Code mode). Both modes share the same set of tools — Pat can generate PDFs,
              spreadsheets, search the web, run shell commands, edit files, and more.
            </p>
            <Callout>
              Your conversations, attached files, generated documents, and memory entries are stored
              in a local SQLite database. Nothing is sent off your machine unless you explicitly
              connect a third-party MCP server.
            </Callout>
          </Section>

          <Section id="getting-started" title="Getting started">
            <h3>Install Ollama</h3>
            <p>
              Pat requires <Link href="https://ollama.ai">Ollama</Link> to run. Install it,
              then start it (it runs as a background service on macOS).
            </p>
            <h3>Install at least one model</h3>
            <p>
              Open <Link href="/settings">Settings → Dependencies</Link> and click Install on the
              models you want. Each role (chat, code, reasoning, vision, embeddings) needs at least
              one installed model. We recommend starting with:
            </p>
            <ul>
              <li><Code>qwen2.5:14b</Code> for general chat (best balance of speed and quality)</li>
              <li><Code>qwen2.5-coder:14b</Code> for code work</li>
              <li><Code>nomic-embed-text</Code> for memory (small, required)</li>
            </ul>
            <h3>Try a chat</h3>
            <p>
              Hit <Code>New chat</Code> and ask Pat to do something. If you want a file out of it,
              say so explicitly — &quot;create a PDF that summarizes…&quot;.
            </p>
          </Section>

          <Section id="chat-mode" title="Chat mode">
            <p>
              The default mode. Conversational, with full access to the tool catalog. Select a model
              from the dropdown next to the send button. The model selector filters to chat-capable
              models — chat, reasoning, or vision.
            </p>
            <h3>Reasoning models</h3>
            <p>
              When you pick a reasoning model like <Code>deepseek-r1:8b</Code>, you&apos;ll see a live
              &quot;Pat is thinking…&quot; panel showing the model&apos;s internal reasoning before it answers.
              The panel auto-collapses after the answer streams in — click to re-expand.
            </p>
            <h3>Suggestion cards</h3>
            <p>
              On a fresh conversation, four suggestion cards pre-fill the input. They&apos;re starting
              points — feel free to edit before sending.
            </p>
          </Section>

          <Section id="code-mode" title="Code mode">
            <p>
              Code mode points Pat at a folder on your machine. From there, Pat can read, write,
              edit, and search files; run shell commands; check git status and diffs; and use any
              tool from the catalog.
            </p>
            <h3>Workspace picker</h3>
            <p>
              Click <Code>Set workspace</Code> to choose a folder. In the Electron app this opens
              a native macOS folder picker. In dev mode (browser), paste a path manually.
            </p>
            <h3>What Pat can do</h3>
            <ul>
              <li>Read and edit files (Pat will use targeted find-and-replace, not blind rewrites)</li>
              <li>Search code with grep + line context</li>
              <li>Run npm scripts, tests, lint, build commands</li>
              <li>Inspect <Code>git status</Code> and <Code>git diff</Code></li>
              <li>Generate any file from the catalog (PDFs, docs, etc.) without leaving the agent</li>
            </ul>
            <Callout>
              Pat doesn&apos;t commit to git automatically. You stay in control of version history.
            </Callout>
          </Section>

          <Section id="attachments" title="File attachments">
            <p>
              In Chat mode you can attach files two ways:
            </p>
            <ul>
              <li>Click the paperclip icon to the left of the input</li>
              <li>Drag and drop one or more files anywhere in the chat window</li>
            </ul>
            <p>
              Text-based files (<Code>.md</Code>, <Code>.txt</Code>, <Code>.json</Code>, source code,
              CSVs, etc.) are extracted up to 50,000 characters and injected into Pat&apos;s context.
              For binary files (images, PDFs, etc.), Pat sees the filename and metadata only — image
              vision support is in progress.
            </p>
            <p>
              Attached files appear as cream chips above your message. On reload they&apos;re still there.
              Files persist forever; to clear, use Settings → Data Controls → Clear uploads.
            </p>
          </Section>

          <Section id="tools" title="Tools reference">
            <p>
              Pat has {tools.length} built-in tools. Each can be enabled or disabled per-user in
              Settings → Tools. The tool list is always available to all models, but smaller models
              call tools less reliably — the Tools panel will warn you when your selected model
              isn&apos;t a strong tool caller.
            </p>
            <ToolTable tools={tools} />
            <h3>How tool calling works</h3>
            <p>
              When the model wants to use a tool, it emits a special block in its output — typically
              <Code>{"<tool_call>{...}</tool_call>"}</Code>. Pat parses these blocks, runs the tool,
              and feeds the result back to the model so it can continue.
            </p>
            <p>
              You see this end-to-end as the activity feed: <strong>Calling create_pdf… → Used create_pdf · report.pdf · 12.3 KB</strong>.
              The generated file appears as a download chip in the assistant&apos;s reply.
            </p>
            <h3>Verifying tools work</h3>
            <p>
              In <Link href="/settings">Settings → Tools</Link> there&apos;s a <strong>Verify your toolset</strong>
              panel. Click <Code>Run all</Code> to execute every tool with realistic sample inputs.
              Anything that fails will show a clear error.
            </p>
          </Section>

          <Section id="models" title="Models">
            <p>
              Models are managed via Ollama and surfaced in Pat&apos;s Dependencies panel. Each model
              has a role tag — chat, code, reasoning, vision, or embeddings — that determines which
              dropdowns it appears in.
            </p>
            <h3>Tool-call reliability tiers</h3>
            <ul>
              <li><strong>High:</strong> Mistral, Qwen 2.5 (14B+), DeepSeek Coder, Mixtral</li>
              <li><strong>Medium:</strong> Llama 3.x, Qwen 2.5 (7B), Phi-4, DeepSeek R1, Gemma</li>
              <li><strong>Low:</strong> models smaller than 7B</li>
            </ul>
            <p>
              For Code mode, prefer 14B+ models. They&apos;re slower but call tools much more reliably.
            </p>
            <h3>Default model</h3>
            <p>
              In Settings → Models you can set a default chat model and a default code model. The
              dropdown next to the send button can override per-message; that override is remembered
              for the duration of the session.
            </p>
          </Section>

          <Section id="memory" title="Memory">
            <p>
              Pat has a semantic memory store powered by local embeddings (<Code>nomic-embed-text</Code>,
              768-dim). Memories are short text snippets — facts about you, your preferences, your
              recurring projects.
            </p>
            <h3>How it&apos;s used</h3>
            <p>
              Before each chat response, Pat embeds your message and finds the top 5 most relevant
              memories above a similarity threshold. Those are injected into the system prompt. You
              don&apos;t need to do anything — it&apos;s automatic.
            </p>
            <h3>Adding and managing memories</h3>
            <p>
              Settings → Memory lets you add, edit, and delete memories manually. Future versions
              will offer auto-extraction from conversations.
            </p>
          </Section>

          <Section id="mcp" title="MCP servers">
            <p>
              The <Link href="https://modelcontextprotocol.io">Model Context Protocol</Link> lets
              external tools expose themselves to AI agents. Pat supports both StreamableHTTP and SSE
              transports. Add an MCP server in Settings → MCP Servers; its tools become available
              to both Chat and Code modes.
            </p>
            <p>
              Common MCP servers worth connecting: Linear, Slack, Salesforce, Gong, Notion, GitHub.
            </p>
            <Callout>
              MCP servers run on remote machines. Tool-call data sent to them leaves your computer —
              check each server&apos;s privacy policy before connecting it.
            </Callout>
          </Section>

          <Section id="settings" title="Settings">
            <p>The settings page is organized into three groups:</p>
            <h3>Setup</h3>
            <ul>
              <li><strong>General:</strong> Account name, theme, system prompt</li>
              <li><strong>Models:</strong> Default chat and code models</li>
              <li><strong>Dependencies:</strong> Ollama health check, install models</li>
            </ul>
            <h3>Data &amp; Connections</h3>
            <ul>
              <li><strong>Tools:</strong> Enable/disable individual tools, run sanity tests</li>
              <li><strong>MCP Servers:</strong> Connect external services</li>
              <li><strong>Memory:</strong> Manage long-term memory entries</li>
              <li><strong>Data Controls:</strong> Export or wipe local data</li>
            </ul>
            <h3>System</h3>
            <ul>
              <li><strong>About:</strong> Build info, runtime status, privacy</li>
            </ul>
          </Section>

          <Section id="data" title="Data & privacy">
            <p>
              Everything Pat stores lives in two locations on your computer:
            </p>
            <ul>
              <li>
                <strong>Database:</strong> SQLite file at <Code>~/Library/Application Support/nexus/nexus.db</Code> in the
                Electron app, or <Code>./prisma/data/app.db</Code> in dev. Holds conversations, messages, code
                sessions, MCP server configs, memory entries, and metadata.
              </li>
              <li>
                <strong>Files:</strong> <Code>~/Library/Application Support/nexus/generated/</Code> for tool-generated
                files; <Code>~/Library/Application Support/nexus/uploads/</Code> for files you attach.
              </li>
            </ul>
            <p>
              No telemetry. No automatic updates that phone home. The only outbound network calls
              Pat makes are to Ollama (localhost) and any MCP servers or web URLs you explicitly invoke.
            </p>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <h3>Pat says it created a file but I don&apos;t see it</h3>
            <p>
              Check Settings → Tools → <strong>Verify your toolset</strong> and run the file-creation
              tools. If those pass but Pat is still failing in conversation, switch to a higher-tier
              model — small models often <em>describe</em> using a tool instead of <em>actually</em>
              calling it.
            </p>
            <h3>The model is slow</h3>
            <p>
              Inference speed depends on the model size and your machine. On Apple Silicon, expect
              ~30 tokens/sec for 7B models, ~15 for 14B. If responses crawl, switch to a smaller model
              for chat (keep the 14B for code).
            </p>
            <h3>Ollama isn&apos;t running</h3>
            <p>
              Open Settings → Dependencies. The Ollama card shows the status. If it&apos;s red, run
              <Code>ollama serve</Code> in a terminal, or restart the Ollama app.
            </p>
            <h3>Reasoning shows as raw text</h3>
            <p>
              That&apos;s a model that emits <Code>{"<think>"}</Code> blocks but uses an unusual tag.
              File an issue and we&apos;ll add a parser variant.
            </p>
          </Section>

          <div className="pt-12 text-xs text-center" style={{ color: "var(--pat-muted)" }}>
            Pat · v1.3.0 · Local-first AI
          </div>
        </article>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-serif text-3xl font-medium mb-5" style={{ color: "var(--pat-text)" }}>
        {title}
      </h2>
      <div className="prose-pat space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded font-mono text-[12px]"
      style={{ background: "var(--pat-cream-10)", color: "var(--pat-cream)" }}
    >
      {children}
    </code>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="underline" style={{ color: "var(--pat-cream)" }}>
      {children}
    </a>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border-l-2 px-4 py-3 my-4 text-sm"
      style={{ background: "var(--pat-cream-10)", borderLeftColor: "var(--pat-cream)", color: "var(--pat-text)" }}
    >
      {children}
    </div>
  );
}

function ToolTable({ tools }: { tools: ToolMeta[] }) {
  if (tools.length === 0) {
    return <p style={{ color: "var(--pat-muted)" }}>Loading…</p>;
  }
  const groups = {
    files: tools.filter((t) => t.category === "files"),
    web: tools.filter((t) => t.category === "web"),
    utility: tools.filter((t) => t.category === "utility"),
  };
  const labels = { files: "File generation", web: "Web access", utility: "Utility" };

  return (
    <div className="my-4 space-y-4">
      {(Object.entries(groups) as Array<[keyof typeof groups, ToolMeta[]]>).map(([cat, items]) => (
        <div key={cat}>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--pat-muted)" }}>
            {labels[cat]}
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((t) => (
              <div
                key={t.id}
                className="rounded border px-3 py-2 text-xs"
                style={{ background: "var(--pat-surface)", borderColor: "var(--pat-border)" }}
              >
                <div className="font-medium" style={{ color: "var(--pat-text)" }}>{t.displayName}</div>
                <code className="text-[10px]" style={{ color: "var(--pat-muted)" }}>{t.id}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
