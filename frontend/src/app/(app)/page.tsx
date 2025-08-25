

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect the user from the root path ("/") to the POS page ("/pos")
    router.replace("/pos");
  }, [router]);

  // Return a loading state or null while the redirect happens
  return <div>Loading...</div>;
}