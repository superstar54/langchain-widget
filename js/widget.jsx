import * as React from "react";
import { createRender, useModel, useModelState } from "@anywidget/react";
import "./widget.css";

function renderInline(text, getKey) {
	const parts = [];
	const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
	let lastIndex = 0;
	let match;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}
		const token = match[0];
		if (token.startsWith("`")) {
			parts.push(
				<code className="lcw_inline_code" key={getKey()}>
					{token.slice(1, -1)}
				</code>,
			);
		} else {
			parts.push(<strong key={getKey()}>{token.slice(2, -2)}</strong>);
		}
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}
	return parts;
}

function renderInlineWithBreaks(text, getKey) {
	const lines = text.split("\n");
	const rendered = [];
	lines.forEach((line, idx) => {
		if (idx > 0) {
			rendered.push(<br key={getKey()} />);
		}
		rendered.push(...renderInline(line, getKey));
	});
	return rendered;
}

function splitTableRow(line) {
	let trimmed = line.trim();
	if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
	if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
	return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
	return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function renderMarkdown(content) {
	if (!content) return null;
	const lines = String(content).split(/\r?\n/);
	const blocks = [];
	let i = 0;
	let blockId = 0;
	let inlineId = 0;
	const nextBlockKey = () => `md-${blockId++}`;
	const nextInlineKey = () => `md-inline-${inlineId++}`;

	const isListItem = (line) => /^\s*[-*]\s+/.test(line);
	const isHeading = (line) => /^\s*#{1,4}\s+/.test(line);
	const isTableStart = (idx) => {
		if (idx + 1 >= lines.length) return false;
		const header = lines[idx];
		if (!header.includes("|")) return false;
		return isTableSeparator(lines[idx + 1]);
	};

	while (i < lines.length) {
		const line = lines[i];
		if (!line.trim()) {
			i += 1;
			continue;
		}

		if (line.startsWith("```")) {
			const fence = line.trim();
			const codeLines = [];
			i += 1;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i += 1;
			}
			if (i < lines.length && lines[i].startsWith("```")) {
				i += 1;
			}
			const code = codeLines.join("\n");
			blocks.push(
				<pre className="lcw_pre lcw_codeblock" key={nextBlockKey()}>
					{code || fence}
				</pre>,
			);
			continue;
		}

		if (isTableStart(i)) {
			const headers = splitTableRow(lines[i]);
			i += 2;
			const rows = [];
			while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
				if (isTableSeparator(lines[i])) {
					i += 1;
					continue;
				}
				rows.push(splitTableRow(lines[i]));
				i += 1;
			}
			blocks.push(
				<div className="lcw_table_wrap" key={nextBlockKey()}>
					<table className="lcw_table">
						<thead>
							<tr>
								{headers.map((cell) => (
									<th key={nextBlockKey()}>{renderInline(cell, nextInlineKey)}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, rowIdx) => (
								<tr key={`${nextBlockKey()}-${rowIdx}`}>
									{row.map((cell) => (
										<td key={nextBlockKey()}>{renderInline(cell, nextInlineKey)}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		if (isHeading(line)) {
			const trimmed = line.trim();
			const level = Math.min(4, trimmed.match(/^#+/)[0].length);
			const text = trimmed.replace(/^#+\s+/, "");
			const HeadingTag = level === 1 ? "h3" : level === 2 ? "h4" : level === 3 ? "h5" : "h6";
			blocks.push(
				<HeadingTag className="lcw_heading" key={nextBlockKey()}>
					{renderInline(text, nextInlineKey)}
				</HeadingTag>,
			);
			i += 1;
			continue;
		}

		if (isListItem(line)) {
			const items = [];
			while (i < lines.length && isListItem(lines[i])) {
				const itemText = lines[i].replace(/^\s*[-*]\s+/, "");
				items.push(itemText);
				i += 1;
			}
			blocks.push(
				<ul className="lcw_list" key={nextBlockKey()}>
					{items.map((item, idx) => (
						<li key={`${nextBlockKey()}-${idx}`}>{renderInline(item, nextInlineKey)}</li>
					))}
				</ul>,
			);
			continue;
		}

		const paragraphLines = [];
		while (
			i < lines.length &&
			lines[i].trim() &&
			!lines[i].startsWith("```") &&
			!isTableStart(i) &&
			!isListItem(lines[i]) &&
			!isHeading(lines[i])
		) {
			paragraphLines.push(lines[i]);
			i += 1;
		}
		const paragraphText = paragraphLines.join("\n");
		blocks.push(
			<p className="lcw_paragraph" key={nextBlockKey()}>
				{renderInlineWithBreaks(paragraphText, nextInlineKey)}
			</p>,
		);
	}

	return blocks;
}

function Avatar({ role }) {
	const letter = role === "assistant" ? "A" : role === "tool" ? "T" : "Y";
	return <div className={`lcw_avatar lcw_avatar--${role}`}>{letter}</div>;
}

function Message({ message, logLevel }) {
	if (message.role === "tool") {
		return (
			<div className="lcw_row lcw_row--tool">
				<Avatar role="tool" />
				<div className="lcw_msg">
					<div className="lcw_meta">tool: {message.name || "tool"}</div>
					{logLevel === "debug" ? (
						<pre className="lcw_pre">{message.content}</pre>
					) : (
						<div className="lcw_text">Tool finished.</div>
					)}
				</div>
			</div>
		);
	}

	if (message.role === "assistant") {
		const toolCalls = message.tool_calls || [];
		return (
			<div className="lcw_row lcw_row--assistant">
				<Avatar role="assistant" />
				<div className="lcw_msg">
					<div className="lcw_meta">assistant</div>
					{message.content ? <div className="lcw_markdown">{renderMarkdown(message.content)}</div> : null}
					{toolCalls.length && logLevel !== "minimal" ? (
						logLevel === "debug" ? (
							<details className="lcw_details">
								<summary>Tool calls ({toolCalls.length})</summary>
								{toolCalls.map((tc, idx) => (
									<div key={tc.id || `${tc.name}-${idx}`} className="lcw_toolcall">
										<div className="lcw_toolname">{tc.name}</div>
										<pre className="lcw_pre">{JSON.stringify(tc.args ?? {}, null, 2)}</pre>
									</div>
								))}
							</details>
						) : (
							<div className="lcw_tools_summary">
								Tools: {toolCalls.map((tc) => tc.name).filter(Boolean).join(", ")}
							</div>
						)
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="lcw_row lcw_row--user">
			<Avatar role="user" />
			<div className="lcw_msg">
				<div className="lcw_meta">you</div>
				<div className="lcw_text">{message.content}</div>
			</div>
		</div>
	);
}

const render = createRender(() => {
	const model = useModel();
	const [messages] = useModelState("messages");
	const [status] = useModelState("status");
	const [tools] = useModelState("tools");
	const [title] = useModelState("title");
	const [historyIndex] = useModelState("history_index");
	const [sidebarOpen, setSidebarOpen] = useModelState("sidebar_open");

	const [draft, setDraft] = React.useState("");
	const [logLevel, setLogLevel] = React.useState("minimal"); // minimal | tools | debug
	const chatRef = React.useRef(null);
	const inputRef = React.useRef(null);
	const [isAtBottom, setIsAtBottom] = React.useState(true);
	const [sidebarTab, setSidebarTab] = React.useState("history"); // history | tools | settings
	const isRunning = status && status !== "idle";

	const scrollChatToBottom = React.useCallback(() => {
		const el = chatRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, []);

	React.useEffect(() => {
		if (!sidebarOpen) return;
		model.send({ type: "history_refresh" });
	}, [model, sidebarOpen]);

	const send = React.useCallback(() => {
		if (isRunning) return;
		const text = draft.trim();
		if (!text) return;
		model.send({ type: "user_message", content: text });
		setDraft("");
		requestAnimationFrame(() => {
			try {
				inputRef.current?.focus?.({ preventScroll: true });
			} catch {
				inputRef.current?.focus?.();
			}
		});
	}, [draft, model, isRunning]);

	React.useEffect(() => {
		const handler = (msg) => {
			if (msg?.content?.type === "scroll_to_bottom") {
				if (isAtBottom) scrollChatToBottom();
			}
		};
		model.on("msg:custom", handler);
		return () => model.off("msg:custom", handler);
	}, [model, isAtBottom, scrollChatToBottom]);

	React.useEffect(() => {
		if (!isAtBottom) return;
		scrollChatToBottom();
	}, [messages, status, isAtBottom, scrollChatToBottom]);

	React.useEffect(() => {
		const el = chatRef.current;
		if (!el) return;
		const onScroll = () => {
			const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
			setIsAtBottom(distance < 80);
		};
		onScroll();
		el.addEventListener("scroll", onScroll);
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	const newChat = React.useCallback(() => {
		model.send({ type: "history_new_chat" });
	}, [model]);

	const displayedMessages = React.useMemo(() => {
		const ms = Array.isArray(messages) ? messages : [];
		if (logLevel === "minimal") {
			return ms.filter((m) => m.role !== "tool");
		}
		return ms;
	}, [messages, logLevel]);

	return (
		<div
			className={sidebarOpen ? "langchain_widget lcw_root" : "langchain_widget lcw_root lcw_root--sidebar-collapsed"}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
		>
			{sidebarOpen ? (
				<aside className="lcw_sidebar lcw_sidebar--left">
					<div className="lcw_sidebar_header">
						<div className="lcw_appname">{title || "Agent Chat"}</div>
						<button className="lcw_iconbtn lcw_iconbtn--square" onClick={() => setSidebarOpen(false)} title="Collapse">
							≪
						</button>
					</div>
					<div className="lcw_tabs">
						<button
							className={sidebarTab === "history" ? "lcw_tab lcw_tab--active" : "lcw_tab"}
							onClick={() => setSidebarTab("history")}
						>
							History
						</button>
						<button
							className={sidebarTab === "tools" ? "lcw_tab lcw_tab--active" : "lcw_tab"}
							onClick={() => setSidebarTab("tools")}
						>
							Tools
						</button>
						<button
							className={sidebarTab === "settings" ? "lcw_tab lcw_tab--active" : "lcw_tab"}
							onClick={() => setSidebarTab("settings")}
						>
							Settings
						</button>
					</div>

					<div className="lcw_sidebar_body">
						{sidebarTab === "history" ? (
							<>
								<div className="lcw_hist_actions">
									<button className="lcw_btn lcw_btn--block" onClick={newChat}>
										New chat
									</button>
									<button className="lcw_btn lcw_btn--block" onClick={() => model.send({ type: "history_save" })}>
										Save chat
									</button>
									<button className="lcw_btn lcw_btn--block" onClick={() => model.send({ type: "history_clear" })}>
										Clear history
									</button>
								</div>
								{(historyIndex || []).length ? (
									<ul className="lcw_histlist">
										{historyIndex.map((h) => (
											<li key={h.id} className="lcw_histitem">
												<button className="lcw_histbtn" onClick={() => model.send({ type: "history_load", id: h.id })}>
													<div className="lcw_histtitle">{h.title || "Conversation"}</div>
													<div className="lcw_histmeta">
														{new Date(h.updated_at || h.created_at).toLocaleString()}
													</div>
												</button>
												<button
													className="lcw_histdelete"
													title="Delete"
													onClick={() => model.send({ type: "history_delete", id: h.id })}
												>
													×
												</button>
											</li>
										))}
									</ul>
								) : (
									<div className="lcw_side_empty">No saved chats yet.</div>
								)}
							</>
						) : null}

						{sidebarTab === "tools" ? (
							<>
								<div className="lcw_side_title">Tools</div>
								{(tools || []).length ? (
									<ul className="lcw_toollist">
										{tools.map((t) => (
											<li key={t.name} className="lcw_toolitem" title={t.description || ""}>
												<div className="lcw_toolitem_name">{t.name}</div>
												<div className="lcw_toolitem_desc">{t.description || ""}</div>
											</li>
										))}
									</ul>
								) : (
									<div className="lcw_side_empty">No tools registered.</div>
								)}
							</>
						) : null}

						{sidebarTab === "settings" ? (
							<>
								<div className="lcw_side_title">Settings</div>
								<label className="lcw_selectwrap">
									<span className="lcw_selectlabel">Log level</span>
									<select className="lcw_select" value={logLevel} onChange={(e) => setLogLevel(e.target.value)}>
										<option value="minimal">Minimal</option>
										<option value="tools">Tools</option>
										<option value="debug">Debug</option>
									</select>
								</label>
								<div className="lcw_side_hint">Minimal hides tool messages; Debug shows tool args/results.</div>
							</>
						) : null}
					</div>
				</aside>
			) : (
				<button className="lcw_sidebar_collapsed" onClick={() => setSidebarOpen(true)} title="Open menu">
					☰
				</button>
			)}

			<main className="lcw_main">
				<div className="lcw_topbar">
					<div className="lcw_top_title">{title || "Agent Chat"}</div>
				</div>

				<div className="lcw_chat" ref={chatRef}>
					<div className="lcw_chat_inner">
						{displayedMessages.map((m) => (
							<Message key={m.id} message={m} logLevel={logLevel} />
						))}
						{!isAtBottom ? (
							<button className="lcw_fab" onClick={scrollChatToBottom} onMouseDown={(e) => e.preventDefault()}>
								Jump to latest
							</button>
						) : null}
					</div>
				</div>

				<div className="lcw_composer">
					<div className="lcw_composer_inner">
						<textarea
							ref={inputRef}
							className="lcw_input"
							value={draft}
							disabled={isRunning}
							placeholder="Message…"
							onChange={(e) => setDraft(e.target.value)}
							onMouseDown={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								if (isRunning) return;
								if (e.key !== "Enter") return;

								// Prevent the Jupyter notebook from handling Enter / Shift+Enter while typing in the widget.
								e.preventDefault();
								e.stopPropagation();

								if (e.shiftKey) {
									const el = e.currentTarget;
									const start = typeof el.selectionStart === "number" ? el.selectionStart : draft.length;
									const end = typeof el.selectionEnd === "number" ? el.selectionEnd : start;
									const nextDraft = draft.slice(0, start) + "\n" + draft.slice(end);
									setDraft(nextDraft);

									requestAnimationFrame(() => {
										try {
											el.selectionStart = el.selectionEnd = start + 1;
										} catch {}
									});
									return;
								}

								send();
							}}
						/>
						{isRunning ? (
							<button
								className="lcw_btn"
								onMouseDown={(e) => e.preventDefault()}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									model.send({ type: "cancel" });
								}}
							>
								Stop
							</button>
						) : (
							<button
								className="lcw_btn lcw_btn--primary"
								disabled={!draft.trim()}
								onMouseDown={(e) => e.preventDefault()}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									send();
								}}
							>
								Send
							</button>
						)}
					</div>
					<div className="lcw_hint">Enter to send • Shift+Enter for newline</div>
				</div>
			</main>
		</div>
	);
});

export default { render };
