import { useAuthModal } from "@/hooks/use-auth-modal";
import AuthModal from "./auth-modal";

export default function GlobalAuthModal() {
  const { isOpen, defaultTab, closeModal } = useAuthModal();

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={closeModal}
      defaultTab={defaultTab}
    />
  );
}
