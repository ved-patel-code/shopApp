import axios from "axios";
import { useSession } from "@/components/session-provider";
import { useMemo } from "react";

// This hook creates an Axios instance that is pre-configured with the base URL
// and the user's auth token.
export function useApiClient() {
  const { token } = useSession();

  // useMemo will only re-create the apiClient instance if the `token` changes.
  // On all other re-renders, it will return the same, memoized instance.
  const apiClient = useMemo(() => {
    return axios.create({
      baseURL:
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }, [token]); // <-- The dependency array for useMemo

  return apiClient;
}
