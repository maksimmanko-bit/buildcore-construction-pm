import { Component } from "react";
import { RotateCcw } from "lucide-react";
import { recordClientError } from "../lib/errorLog.js";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    recordClientError(error, {
      source: "react-error-boundary",
      metadata: {
        componentStack: info.componentStack,
      },
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="errorBoundaryScreen">
        <section className="errorBoundaryCard">
          <span className="errorBoundaryBadge">BuildCore</span>
          <h1>Something went wrong</h1>
          <p>
            The app caught this crash and saved a client error log. You can reload safely; saved Supabase data is not changed by this screen.
          </p>
          <code>{this.state.error.message || "Unknown error"}</code>
          <button type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={18} />
            Reload app
          </button>
        </section>
      </main>
    );
  }
}
