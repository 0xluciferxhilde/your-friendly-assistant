import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Network overview is on the home page.</p>
      <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
        <Boxes className="h-4 w-4" /> Go to Network Dashboard
      </Link>
    </div>
  );
}
