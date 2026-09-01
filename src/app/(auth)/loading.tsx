/** Reserve inner slot height — card + logo stay in LoginSessionShell; no skeleton flash on refresh. */
export default function AuthSessionLoading() {
  return <div className="min-h-[260px]" aria-hidden />;
}
