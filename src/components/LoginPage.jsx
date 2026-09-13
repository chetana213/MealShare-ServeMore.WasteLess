import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole, Utensils } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "", role: "Receiver" });
  const [submitting, setSubmitting] = useState(false);
  if (token) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return void toast.error("Please enter a valid email address.");
    if (form.password.length < 6) return void toast.error("Password must be at least 6 characters.");
    setSubmitting(true);
    try {
      await login(form.email, form.password, form.role);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } finally { setSubmitting(false); }
  };

  return <main className="grid min-h-screen place-items-center bg-[#f7faf7] p-4"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"><div className="mb-7 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white"><Utensils /></div><h1 className="text-2xl font-black">Welcome to MealShare</h1><p className="mt-2 text-sm text-slate-500">Sign in to rescue or share food.</p></div><label className="mb-4 block text-sm font-bold">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500" /></label><label className="block text-sm font-bold">Password<input required minLength="6" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500" /></label><label className="block text-sm font-bold">I want to<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500"><option value="Receiver">Receive food</option><option value="Donor">Donate food</option></select></label><button disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60"><LockKeyhole size={17} />{submitting ? "Signing in…" : "Sign in"}</button></form></main>;
}
