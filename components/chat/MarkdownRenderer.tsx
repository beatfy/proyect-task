"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface Block {
  type: "paragraph" | "heading" | "list" | "ordered-list" | "code" | "blockquote" | "table";
  level?: number;
  lang?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  content?: string;
}

// Subcomponente para manejar el estado de copiado en cada bloque de código de forma independiente
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (err) {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    }
  };

  const displayLang = lang ? lang.toUpperCase() : "CODE";

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-md">
      {/* Cabecera del bloque de código */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs font-mono text-neutral-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span>{displayLang}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-neutral-800 hover:text-white transition-colors"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Contenido del código */}
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-[13px] leading-relaxed text-neutral-200">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Tokenizar y renderizar estilos en línea
function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];

  // Normalizar negritas y cursivas alternativas (__ y _)
  let normalized = text
    .replace(/__(.*?)__/g, "**$1**")
    .replace(/_(.*?)_/g, "*$1*");

  interface Token {
    type: "text" | "bold" | "italic" | "code" | "link";
    text: string;
    href?: string;
  }

  let tokens: Token[] = [{ type: "text", text: normalized }];

  // 1. Código en línea
  tokens = tokens.flatMap((token): Token[] => {
    if (token.type !== "text") return [token];
    const parts = token.text.split(/`([^`]+)`/g);
    return parts.map((part, index): Token => {
      if (index % 2 === 1) {
        return { type: "code", text: part };
      }
      return { type: "text", text: part };
    });
  });

  // 2. Enlaces [label](url)
  tokens = tokens.flatMap((token): Token[] => {
    if (token.type !== "text") return [token];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const result: Token[] = [];
    let lastIndex = 0;
    let match;

    regex.lastIndex = 0;
    while ((match = regex.exec(token.text)) !== null) {
      const before = token.text.slice(lastIndex, match.index);
      if (before) {
        result.push({ type: "text", text: before });
      }
      result.push({ type: "link", text: match[1], href: match[2] });
      lastIndex = regex.lastIndex;
    }

    const after = token.text.slice(lastIndex);
    if (after) {
      result.push({ type: "text", text: after });
    }
    return result;
  });

  // 3. Negritas (**)
  tokens = tokens.flatMap((token): Token[] => {
    if (token.type !== "text") return [token];
    const parts = token.text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index): Token => {
      if (index % 2 === 1) {
        return { type: "bold", text: part };
      }
      return { type: "text", text: part };
    });
  });

  // 4. Cursivas (*)
  tokens = tokens.flatMap((token): Token[] => {
    if (token.type !== "text") return [token];
    const parts = token.text.split(/\*([^*]+)\*/g);
    return parts.map((part, index): Token => {
      if (index % 2 === 1) {
        return { type: "italic", text: part };
      }
      return { type: "text", text: part };
    });
  });

  return tokens.map((token, idx) => {
    switch (token.type) {
      case "bold":
        return (
          <strong key={idx} className="font-bold text-foreground dark:text-white">
            {token.text}
          </strong>
        );
      case "italic":
        return (
          <em key={idx} className="italic text-foreground/90 dark:text-neutral-200">
            {token.text}
          </em>
        );
      case "code":
        return (
          <code
            key={idx}
            className="rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--mediterranean-terracotta)] dark:text-amber-400 font-semibold break-all"
          >
            {token.text}
          </code>
        );
      case "link":
        return (
          <a
            key={idx}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--mediterranean-blue)] dark:text-sky-400 hover:underline underline-offset-2 break-all font-medium inline-flex items-center gap-0.5"
          >
            {token.text}
          </a>
        );
      default:
        return <span key={idx}>{token.text}</span>;
    }
  });
}

function parseMarkdown(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Bloque de código
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      let codeContent = "";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeContent += (codeContent ? "\n" : "") + lines[i];
        i++;
      }
      blocks.push({ type: "code", lang, content: codeContent });
      i++; // Saltar cierre
      continue;
    }

    // 2. Citas (Blockquotes)
    if (line.startsWith(">")) {
      let quoteContent = "";
      while (i < lines.length && lines[i].startsWith(">")) {
        const contentLine = lines[i].slice(1).trim();
        quoteContent += (quoteContent ? "\n" : "") + contentLine;
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteContent });
      continue;
    }

    // 3. Títulos (Headings)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Tablas
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const headers = line
        .split("|")
        .map((s) => s.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      i++;
      // Verificar si hay línea divisoria (ej. |---|---|)
      if (i < lines.length && lines[i].trim().startsWith("|") && lines[i].includes("-")) {
        i++;
      }
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const row = lines[i]
          .split("|")
          .map((s) => s.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        rows.push(row);
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // 5. Lista desordenada
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("+ ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ") || lines[i].trim().startsWith("+ "))
      ) {
        const itemContent = lines[i].trim().replace(/^[-*+]\s+/, "");
        items.push(itemContent);
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // 6. Lista ordenada
    const orderedMatch = line.trim().match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+(.+)$/)) {
        const itemContent = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(itemContent);
        i++;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    // 7. Línea vacía
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 8. Párrafo estándar (agrupa líneas consecutivas)
    let paraContent = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      !lines[i].trim().startsWith("+ ") &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|"))
    ) {
      paraContent += "\n" + lines[i];
      i++;
    }
    blocks.push({ type: "paragraph", content: paraContent });
  }

  return blocks;
}

export default function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90 dark:text-neutral-100 break-words">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading":
            const HeadingTag = `h${Math.min(block.level || 1, 6)}` as React.ElementType;
            const headingClasses =
              block.level === 1
                ? "text-xl font-bold mt-4 mb-2 pb-1 border-b border-neutral-200/50 dark:border-neutral-800/50 text-foreground dark:text-white"
                : block.level === 2
                ? "text-lg font-semibold mt-3 mb-2 text-foreground dark:text-white"
                : "text-base font-semibold mt-2.5 mb-1.5 text-foreground dark:text-white";
            return (
              <HeadingTag key={idx} className={headingClasses}>
                {renderInline(block.content || "")}
              </HeadingTag>
            );

          case "code":
            return <CodeBlock key={idx} code={block.content || ""} lang={block.lang} />;

          case "blockquote":
            return (
              <blockquote
                key={idx}
                className="my-3 border-l-4 border-[var(--mediterranean-terracotta)] bg-neutral-50 dark:bg-neutral-900/40 py-2 pl-4 pr-3 text-sm italic text-muted-foreground rounded-r-lg"
              >
                {block.content?.split("\n").map((line, lIdx) => (
                  <p key={lIdx}>{renderInline(line)}</p>
                ))}
              </blockquote>
            );

          case "list":
            return (
              <ul key={idx} className="my-2 list-disc pl-5 space-y-1 text-foreground/90 dark:text-neutral-100">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="pl-0.5">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol key={idx} className="my-2 list-decimal pl-5 space-y-1 text-foreground/90 dark:text-neutral-100">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="pl-0.5">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case "table":
            return (
              <div key={idx} className="my-4 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="min-w-full divide-y divide-border text-left text-[13px]">
                  <thead className="bg-muted/50 dark:bg-neutral-800/40">
                    <tr>
                      {block.headers?.map((header, hIdx) => (
                        <th key={hIdx} className="px-4 py-2.5 font-semibold text-foreground dark:text-white">
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {block.rows?.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/20 dark:hover:bg-neutral-800/10 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-2 text-foreground/80 dark:text-neutral-300">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "paragraph":
          default:
            return (
              <p key={idx} className="whitespace-pre-line text-sm text-foreground/90 dark:text-neutral-100">
                {renderInline(block.content || "")}
              </p>
            );
        }
      })}
    </div>
  );
}
