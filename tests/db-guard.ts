/** Refuses to run destructive test setup (migrate reset) against anything that does not look like a local throwaway test database. */
export function assertDestructiveSetupAllowed(url: string) {
  const u = new URL(url);
  const name = u.pathname.replace(/^\//, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  if (!local || !name.includes("test")) {
    throw new Error(`Refusing destructive test setup against non-test database "${u.hostname}/${name}". Test databases must be local and have "test" in the name.`);
  }
}
