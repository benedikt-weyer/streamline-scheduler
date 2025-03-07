import Image from "next/image";
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex m-10">
      <a href="/register" className="underline">Click here to Register</a>
    </div>
  );
}
