import * as React from "react";
import { createRender, useModel, useModelState } from "@anywidget/react";
import "./widget.css";

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
					{message.content ? <div className="lcw_text">{message.content}</div> : null}
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

	const [draft, setDraft] = React.useState("");
	const [logLevel, setLogLevel] = React.useState("minimal"); // minimal | tools | debug
	const endRef = React.useRef(null);
	const chatRef = React.useRef(null);
	const [isAtBottom, setIsAtBottom] = React.useState(true);
	const [sidebarOpen, setSidebarOpen] = React.useState(true);
	const [sidebarTab, setSidebarTab] = React.useState("history"); // history | tools | settings

	React.useEffect(() => {
		if (!sidebarOpen) return;
		model.send({ type: "history_refresh" });
	}, [model, sidebarOpen]);

	const send = React.useCallback(() => {
		const text = draft.trim();
		if (!text) return;
		model.send({ type: "user_message", content: text });
		setDraft("");
	}, [draft, model]);

	React.useEffect(() => {
		const handler = (msg) => {
			if (msg?.content?.type === "scroll_to_bottom") {
				if (isAtBottom) endRef.current?.scrollIntoView({ block: "end" });
			}
		};
		model.on("msg:custom", handler);
		return () => model.off("msg:custom", handler);
	}, [model, isAtBottom]);

	React.useEffect(() => {
		if (!isAtBottom) return;
		endRef.current?.scrollIntoView({ block: "end" });
	}, [messages, status, isAtBottom]);

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
		<div className="langchain_widget lcw_root">
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
													className="lcw_iconbtn lcw_iconbtn--square"
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
					<div className="lcw_top_actions">
						<span className="lcw_status">{status}</span>
						<button
							className="lcw_btn"
							onClick={() => model.send({ type: "cancel" })}
							disabled={status === "idle"}
						>
							Stop
						</button>
						<button className="lcw_btn" onClick={() => model.send({ type: "reset" })}>
							Clear
						</button>
					</div>
				</div>

				<div className="lcw_chat" ref={chatRef}>
					<div className="lcw_chat_inner">
						{displayedMessages.map((m) => (
							<Message key={m.id} message={m} logLevel={logLevel} />
						))}
						<div ref={endRef} />
						{!isAtBottom ? (
							<button className="lcw_fab" onClick={() => endRef.current?.scrollIntoView({ block: "end" })}>
								Jump to latest
							</button>
						) : null}
					</div>
				</div>

				<div className="lcw_composer">
					<div className="lcw_composer_inner">
						<textarea
							className="lcw_input"
							value={draft}
							placeholder="Message…"
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
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
						<button className="lcw_btn lcw_btn--primary" onClick={send}>
							Send
						</button>
					</div>
					<div className="lcw_hint">Enter to send • Shift+Enter for newline</div>
				</div>
			</main>
		</div>
	);
});

export default { render };
