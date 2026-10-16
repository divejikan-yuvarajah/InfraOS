import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16"
    >
      <h1 className="text-2xl font-semibold text-text-primary">Page not found</h1>
      <p className="text-text-secondary">
        This route is not part of the INFRAOS frontend foundation yet.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-infra-orange underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </main>
  );
}
