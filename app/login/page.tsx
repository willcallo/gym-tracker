import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <h1 className="mb-1 text-2xl font-bold">Gym Tracker</h1>
      <p className="mb-6 text-sm text-gray-600">Enter the password to continue.</p>
      <LoginForm next={next} />
    </div>
  );
}
