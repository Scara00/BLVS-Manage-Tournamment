import type { Metadata } from "next";
import { LoginForm } from "@/components/auth";
import { signIn, signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return <LoginForm signIn={signIn} signOut={signOut} />;
}
