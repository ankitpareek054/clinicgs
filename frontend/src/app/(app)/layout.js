import ProtectedShell from "../../components/layout/protectedShell";

export default function AppLayout({ children }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
