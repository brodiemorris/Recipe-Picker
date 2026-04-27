"use client";

import { useRouter } from "next/navigation";
import FridgeView from "@/app/components/FridgeView";

export default function SavedPage() {
  const router = useRouter();
  return <FridgeView onBack={() => router.push("/")} />;
}
