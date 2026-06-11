import { Suspense } from "react";

import { AuthCallbackClient } from "@/app/auth/callback/auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackClient />
    </Suspense>
  );
}
