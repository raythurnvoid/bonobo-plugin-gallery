import { bonobo_ui_connect } from "bonobo-plugin-sdk/frontend";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./gallery.css";

function BootScreen(props: { message: string; isError?: boolean }) {
	return <div className={props.isError ? "boot-screen is-error" : "boot-screen"}>{props.message}</div>;
}

const container = document.getElementById("root");
if (!container) {
	// Unreachable: index.html always ships the #root element.
	throw new Error("index.html is missing the #root element");
}
const root = createRoot(container);
root.render(<BootScreen message="Connecting…" />);

bonobo_ui_connect().then(
	(client) => {
		document.title = client.context.pageTitle;
		root.render(<App client={client} />);
	},
	(error: unknown) => {
		root.render(<BootScreen message={error instanceof Error ? error.message : String(error)} isError />);
	},
);
