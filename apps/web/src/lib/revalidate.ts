// Call after any admin mutation to bust ISR cache immediately.
// Uses the admin cookie for auth — no secret needed in client code.
export async function revalidate(...tags: string[]): Promise<void> {
  try {
    await fetch("/api/admin-revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  } catch {
    // Non-fatal — page will refresh on next ISR cycle anyway
  }
}
