import { HouseholdSetupScreen } from "@/components/HouseholdSetupScreen";
import { router } from "expo-router";

export default function SweetSetupRoute() {
  return <HouseholdSetupScreen onComplete={() => router.back()} />;
}
