import { HouseholdSetupScreen } from "@/components/HouseholdSetupScreen";
import { router } from "expo-router";

export default function SweetSetupRoute() {
  return (
    <HouseholdSetupScreen
      onComplete={(destination) => {
        if (destination === "essentials") {
          router.replace("/planning?type=home-checklist" as never);
        } else {
          router.back();
        }
      }}
    />
  );
}
