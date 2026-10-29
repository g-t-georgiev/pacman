import "./index.css";
import "./styles/transitions.css";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const rootElement = document.querySelector<HTMLDivElement>("#root")!;
const appContainer = createRoot(rootElement);

appContainer.render(<App />);
