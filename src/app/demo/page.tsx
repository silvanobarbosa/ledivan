import { DemoStarter } from "./DemoStarter";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ornaments flex items-center justify-center p-4">
      <div className="glass-card-lg w-full max-w-md p-10">
        <DemoStarter />
      </div>
    </div>
  );
}
