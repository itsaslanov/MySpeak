import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const loader = document.getElementById("il");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);

loader?.remove();
