import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
