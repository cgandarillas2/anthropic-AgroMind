import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-2">AgroMind</h1>
        <p className="text-green-600 mb-8 text-sm">ERP Agrícola Inteligente</p>
        <SignUp />
      </div>
    </div>
  );
}
