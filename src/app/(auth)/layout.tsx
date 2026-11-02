import { RedirectIfAuthenticated } from "@/components/redirect-if-authenticated";

// A signed-in visitor is redirected away, so this segment cannot be validated
// as an instant navigation.
export const instant = false;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>;
}
