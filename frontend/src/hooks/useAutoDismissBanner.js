import { useEffect } from "react";

export default function useAutoDismissBanner({
  error,
  notice,
  setError,
  setNotice,
  delay = 15000,
}) {
  useEffect(() => {
    if (!error && !notice) {
      return;
    }

    const timeout = setTimeout(() => {
      setError("");
      setNotice("");
    }, delay);

    return () => clearTimeout(timeout);
  }, [error, notice, setError, setNotice, delay]);
}