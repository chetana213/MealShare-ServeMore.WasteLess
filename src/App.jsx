import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import api from "./api/axios";
import { validateListing } from "./lib/mealLifecycle";
import {
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Heart,
  Leaf,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Utensils,
  Users,
  X,
  LogOut,
  Mail,
  Lock,
  UserPlus,
} from "lucide-react";

function normalizeFood(food) {
  return {
    ...food,
    id: Number(food.id),
    expiresAt: new Date(food.expiresAt ?? food.expires_at).getTime(),
    dietary: Array.isArray(food.dietary) ? food.dietary : [],
    status: String(food.status || "available").toLowerCase(),
    donor: food.donor || "MealShare donor",
    distanceKm: food.distanceKm ?? null,
  };
}

function normalizeAnalytics(data) {
  return {
    mealsSaved: Number(data?.totalMealsSaved ?? 0),

    activeDonors: Number(data?.activeDonors ?? 0),

    wastePrevented: Math.round(
      (data?.completedQuantities || []).reduce((total, quantity) => {
        const numbers =
          String(quantity).match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        const servings =
          numbers.length >= 2
            ? (numbers[0] + numbers[1]) / 2
            : numbers[0] || 0;
        return total + servings * 0.5;
      }, 0) * 10
    ) / 10,

    rescues: Array.isArray(data?.recentFoodRescues)
      ? data.recentFoodRescues.map((item) => ({
          id: item.id,
          food: item.food,
          location: item.location,
          claimant: item.claimant,
          status: String(item.status || "").toUpperCase(),
          date: item.completedAt || item.claimedAt || "—",
        }))
      : [],
  };
}
function formatTimeLeft(expiresAt, now) {
  const difference = Math.max(0, expiresAt - now);

  const minutes = Math.floor(difference / 60000);
  const seconds = Math.floor((difference % 60000) / 1000);

  if (minutes <= 0 && seconds <= 0) {
    return "Expired";
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function Dashboard({ initialTab = "feed" }) {
  const { user, logout } = useAuth();
  const [foods, setFoods] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState(() => user?.role === "Donor" ? "donor" : "receiver");
  const isDonor = user?.role === "Donor";
  const isReceiver = user?.role === "Receiver";
  const [loadingFoods, setLoadingFoods] = useState(true);

  useEffect(() => {
    if (!isDonor && activeTab === "offer") setActiveTab("feed");
  }, [isDonor, activeTab]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [notification, setNotification] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [claimedFood, setClaimedFood] = useState(null);
  const [rescues, setRescues] = useState([]);
  const [impact, setImpact] = useState({ mealsSaved: 0, wastePrevented: 0, activeDonors: 0 });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackTag, setFeedbackTag] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const claimingFoodId = useRef(null);

  const [form, setForm] = useState({
    title: "",
    quantity: "",
    location: "",
    expiry: "",
    expiryMinutes: "",
    dietary: [],
  });

  const loadFoods = async (showLoader = true) => {
    if (showLoader) setLoadingFoods(true);

    try {
      const response = await api.get("/foods");
      setFoods((response.data?.foods || []).map(normalizeFood));
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Could not load food listings.",
        "error",
      );
    } finally {
      if (showLoader) setLoadingFoods(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await api.get("/analytics");
      const normalized = normalizeAnalytics(response.data);
      setImpact((current) => ({
        ...current,
        mealsSaved: normalized.mealsSaved,
        activeDonors: normalized.activeDonors,
        wastePrevented: normalized.wastePrevented,
      }));
      setRescues(normalized.rescues);
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Could not load impact analytics.",
        "error",
      );
    }
  };

  useEffect(() => {
    loadFoods();
    loadAnalytics();

    const interval = setInterval(() => {
      setNow(Date.now());
      loadFoods(false);
      loadAnalytics();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      setNotification(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [notification]);

  const filteredFoods = useMemo(() => {
    const results = foods.filter((food) => {
      const matchesSearch =
        food.title.toLowerCase().includes(search.toLowerCase()) ||
        food.location.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || statusFilter === "distance" || food.status === statusFilter;

      const matchesDietary =
        !vegOnly || food.dietary.includes("Vegetarian");

      const matchesUrgency = !expiringSoon || (food.status === FOOD_STATUS.AVAILABLE && food.expiresAt - now < 30 * 60 * 1000);
      return matchesSearch && matchesStatus && matchesDietary && matchesUrgency;
    });
    return statusFilter === "distance" ? [...results].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)) : results;
  }, [foods, search, statusFilter, vegOnly, expiringSoon, now]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    toast[type === "error" ? "error" : "success"](message);
  };

  const handleClaim = async (food) => {
    if (!isReceiver) {
      return showNotification("Only receivers can claim food.", "error");
    }

    if (claimingFoodId.current === food.id) return;
    claimingFoodId.current = food.id;

    try {
      const response = await api.post(`/foods/${food.id}/claim`);

      const claimed = normalizeFood({
        ...food,
        status: "claimed",
        pickupCode: response.data?.claim?.pickup_code || "",
      });

      setFoods((currentFoods) =>
        currentFoods.map((item) => item.id === food.id ? claimed : item)
      );

      setClaimedFood(claimed);
      setSelectedFood(null);

      await loadAnalytics();

      showNotification(
        response.data?.message || `${food.title} successfully claimed!`
      );
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Could not claim this meal.",
        "error",
      );
    } finally {
      claimingFoodId.current = null;
    }
  };

  const handleCompletePickup = async () => {
    if (!claimedFood?.id) return;

    try {
      const response = await api.post(
        `/foods/${claimedFood.id}/complete`,
        { pickupCode: verificationCode.trim().toUpperCase() },
      );

      const completedFood = normalizeFood({
        ...claimedFood,
        ...(response.data?.food || {}),
        status: response.data?.food?.status || "completed",
      });

      setFoods((currentFoods) =>
        currentFoods.map((food) =>
          food.id === completedFood.id ? completedFood : food
        )
      );

      setVerificationCode("");
      setClaimedFood(null);

      await loadAnalytics();

      showNotification(
        response.data?.message ||
          "Pickup completed. Thank you for rescuing a meal!",
      );
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Could not complete pickup.",
        "error",
      );
    }
  };

  const copyPickupCode = async () => {
    if (!claimedFood?.pickupCode) return;
    try {
      await navigator.clipboard.writeText(claimedFood.pickupCode);
      toast.success("Pickup code copied to clipboard.");
    } catch {
      toast.error("Could not copy the pickup code.");
    }
  };

  const submitRating = () => {
    if (!rating) return toast.error("Choose a star rating first.");
    toast.success(`Thanks for rating this donor ${rating}/5${feedbackTag ? ` — ${feedbackTag}` : ""}.`);
    setRating(0);
    setFeedbackTag("");
  };

  const downloadImpactSummary = () => {
    const rows = [["Food", "Location", "Claimant", "Status", "Time"], ...rescues.map((item) => [item.food, item.location, item.claimant, item.status, item.date])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mealshare-impact-summary.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Impact summary downloaded.");
  };

  const handlePublish = async (event) => {
    event.preventDefault();

    if (!isDonor) {
      return showNotification("Only donors can publish food.", "error");
    }

    const validationError = validateListing(form);
    if (validationError) return showNotification(validationError, "error");

    const expiryDate = form.expiryMinutes
      ? new Date(Date.now() + Number(form.expiryMinutes) * 60 * 1000)
      : new Date(form.expiry);

    try {
      const response = await api.post("/foods", {
        title: form.title.trim(),
        quantity: form.quantity.trim(),
        location: form.location.trim(),
        expiresAt: expiryDate.toISOString(),
        dietary: form.dietary,
      });

      const createdFood = normalizeFood(response.data?.food || response.data);

      setFoods((currentFoods) => [createdFood, ...currentFoods]);

      setForm({
        title: "",
        quantity: "",
        location: "",
        expiry: "",
        expiryMinutes: "",
        dietary: [],
      });

      showNotification(
        response.data?.message || "Food listing published successfully!"
      );

      setActiveTab("feed");
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Could not publish food listing.",
        "error",
      );
    }
  };

  const toggleDietary = (tag) => {
    setForm((current) => ({
      ...current,
      dietary: current.dietary.includes(tag)
        ? current.dietary.filter((item) => item !== tag)
        : [...current.dietary, tag],
    }));
  };

  const statusLabel = {
    available: "AVAILABLE",
    claimed: "CLAIMED",
    completed: "COMPLETED",
    expired: "EXPIRED",
  };

  const statusClasses = {
    available:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    claimed:
      "bg-amber-50 text-amber-700 border-amber-200",
    completed:
      "bg-sky-50 text-sky-700 border-sky-200",
    expired:
      "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <div className="min-h-screen bg-[#f7faf7] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Utensils size={22} />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                MealShare
              </h1>
              <p className="text-xs text-slate-500">
                Serve More. Waste Less.
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            <button
              onClick={() => setActiveTab("feed")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === "feed"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Active Food Feed
            </button>

            {isDonor && <button
              onClick={() => setActiveTab("offer")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === "offer"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Offer Food
            </button>}

            <button
              onClick={() => setActiveTab("analytics")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === "analytics"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Impact Analytics
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 sm:flex">
              {isDonor ? "Donor Account" : "Receiver Account"}
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex">
              <Sparkles size={15} />
              {impact.mealsSaved} Meals Rescued
            </div>

            <div
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold sm:flex"
            >
              <Users size={17} />
              {user?.name || (isDonor ? "Donor" : "Receiver")}
              <ChevronDown size={15} />
            </div>

            <button
              onClick={logout}
              className="hidden items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 sm:flex"
              title="Sign out"
            >
              <LogOut size={16} />
              Sign out
            </button>

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="rounded-xl border border-slate-200 p-2 lg:hidden"
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setActiveTab("feed");
                  setMobileMenu(false);
                }}
                className="rounded-xl p-3 text-left font-semibold hover:bg-slate-100"
              >
                Active Food Feed
              </button>

              {isDonor && (
                <button
                  onClick={() => {
                    setViewMode("donor");
                    setActiveTab("offer");
                    setMobileMenu(false);
                  }}
                  className="rounded-xl p-3 text-left font-semibold hover:bg-slate-100"
                >
                  Offer Food
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab("analytics");
                  setMobileMenu(false);
                }}
                className="rounded-xl p-3 text-left font-semibold hover:bg-slate-100"
              >
                Impact Analytics
              </button>

              <button
                onClick={logout}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 p-3 text-left font-bold text-white hover:bg-slate-800"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HERO */}
        <section className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <Leaf size={14} />
                Community-powered food rescue
              </div>

              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                Good food deserves
                <span className="text-emerald-400">
                  {" "}another table.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Connect surplus food with students and residents
                nearby before it expires. Every claim is one less
                meal wasted.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ImpactMini value={impact.mealsSaved} label="Meals Saved" />
              <ImpactMini value={`${impact.wastePrevented}kg`} label="Waste Prevented" />
              <ImpactMini value={impact.activeDonors} label="Active Donors" />
            </div>
          </div>
        </section>

        {/* TABS */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <TabButton
            active={activeTab === "feed"}
            onClick={() => setActiveTab("feed")}
            icon={<Utensils size={17} />}
            label="Food Feed"
          />

          {isDonor && (
            <TabButton
              active={activeTab === "offer"}
              onClick={() => {
                setViewMode("donor");
                setActiveTab("offer");
              }}
              icon={<Plus size={17} />}
              label="Offer Food"
            />
          )}

          <TabButton
            active={activeTab === "analytics"}
            onClick={() => setActiveTab("analytics")}
            icon={<Sparkles size={17} />}
            label="Impact"
          />
        </div>

        {/* FEED */}
        {activeTab === "feed" && (
          <section>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold text-emerald-600">
                  LIVE COMMUNITY FEED
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Available near you
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Claim surplus food before the timer runs out.
                </p>
              </div>

              {isDonor && (
                <button
                  onClick={() => {
                    setViewMode("donor");
                    setActiveTab("offer");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
                >
                  <Plus size={18} />
                  Offer Surplus Food
                </button>
              )}
            </div>

            {/* FILTERS */}
            <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search food or location..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
              >
                <option value="all">All Status</option>
                <option value="available">Available Now</option>
                <option value="claimed">Claimed</option>
                <option value="expired">Expired</option>
                <option value="distance">Sort by Distance</option>
              </select>

              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  vegOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <Filter size={17} />
                Veg Only
              </button>

              <button
                onClick={() => setExpiringSoon(!expiringSoon)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${expiringSoon ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <Clock3 size={17} />
                Expiring Soon
              </button>
            </div>

            {/* FOOD CARDS */}
            {loadingFoods ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading community food listings...
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredFoods.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    now={now}
                    statusLabel={statusLabel}
                    statusClasses={statusClasses}
                    canClaim={isReceiver}
                    onClaim={() => {
                      if (isReceiver && food.status === "available") {
                        setSelectedFood(food);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {filteredFoods.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Utensils className="mx-auto mb-3 text-slate-400" size={35} />
                <h3 className="font-bold">No food found</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or filters.
                </p>
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); setVegOnly(false); setExpiringSoon(false); }}
                  className="mt-5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* OFFER */}
        {activeTab === "offer" && isDonor && (
          <section className="mx-auto max-w-3xl">
            <div className="mb-6">
              <p className="text-sm font-bold text-emerald-600">
                DONOR MODE
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">
                Post Excess Food
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Tell your community what is available and when it
                needs to be picked up.
              </p>
            </div>

            <form
              onSubmit={handlePublish}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="space-y-5">
                <FormField
                  label="Food Title / Items"
                  required
                  placeholder="Paneer Butter Masala & 15 Chapatis"
                  value={form.title}
                  onChange={(value) =>
                    setForm({ ...form, title: value })
                  }
                />

                <FormField
                  label="Quantity / Estimated Servings"
                  required
                  placeholder="Feeds 8–10 people"
                  value={form.quantity}
                  onChange={(value) =>
                    setForm({ ...form, quantity: value })
                  }
                />

                <FormField
                  label="Pickup Location / Block"
                  required
                  placeholder="Hostel Block 3, Ground Floor Mess"
                  value={form.location}
                  onChange={(value) =>
                    setForm({ ...form, location: value })
                  }
                />

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Expiry Time (minutes)
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 45"
                    value={form.expiryMinutes}
                    onChange={(e) => setForm({ ...form, expiryMinutes: e.target.value, expiry: "" })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Available Until <span className="text-xs font-medium text-slate-400">(optional alternative)</span>
                  </label>

                  <input
                    type="datetime-local"
                    value={form.expiry}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        expiry: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div>
  <label className="mb-2 block text-sm font-bold">
    Dietary Tags
  </label>

  <div className="flex flex-wrap gap-2">
    {["Vegetarian", "Vegan", "Contains Nuts"].map((tag) => (
      <button
        type="button"
        key={tag}
        onClick={() => toggleDietary(tag)}
        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
          form.dietary.includes(tag)
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white text-slate-600"
        }`}
      >
        {tag}
      </button>
    ))}
  </div>
</div>

<button
  type="submit"
  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
>
  <PackageCheck size={19} />
  Publish Food Listing
</button>
</div>
</form>
</section>
)}

{/* ANALYTICS */}
{activeTab === "analytics" && (
<section>
  <button onClick={downloadImpactSummary} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
    Download Impact Summary
  </button>
  <div className="mb-6">
    <p className="text-sm font-bold text-emerald-600">
      COMMUNITY IMPACT
    </p>

    <h2 className="mt-1 text-3xl font-black tracking-tight">
      Every meal counts.
    </h2>

    <p className="mt-2 text-sm text-slate-500">
      A snapshot of food rescued through MealShare.
    </p>
  </div>

  <div className="grid gap-4 md:grid-cols-3">
    <MetricCard
      icon={<Heart />}
      value={impact.mealsSaved}
      label="Total Meals Saved"
    />

    <MetricCard
      icon={<Leaf />}
      value={`${impact.wastePrevented} kg`}
      label="Food Waste Prevented"
    />

    <MetricCard
      icon={<Users />}
      value={impact.activeDonors}
      label="Active Community Donors"
    />
  </div>

  <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-black">
          Recent Food Rescues
        </h3>

        <p className="text-sm text-slate-500">
          Latest claimed and completed meals.
        </p>
      </div>

      <ShieldCheck className="text-emerald-600" />
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
            <th className="px-3 py-3">Food</th>
            <th className="px-3 py-3">Location</th>
            <th className="px-3 py-3">Claimant</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Time</th>
          </tr>
        </thead>

        <tbody>
          {rescues.map((item) => (
            <tr
              key={item.id}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="px-3 py-4 text-sm font-bold">
                {item.food}
              </td>

              <td className="px-3 py-4 text-sm text-slate-500">
                {item.location}
              </td>

              <td className="px-3 py-4 text-sm text-slate-500">
                {item.claimant}
              </td>

              <td className="px-3 py-4">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {item.status}
                </span>
              </td>

              <td className="px-3 py-4 text-sm text-slate-500">
                {item.date ? new Date(item.date).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</section>
)}
</main>

{/* TOAST */}
{notification && (
  <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        notification.type === "error"
          ? "bg-rose-50 text-rose-600"
          : "bg-emerald-50 text-emerald-600"
      }`}
    >
      {notification.type === "error" ? (
        <X size={18} />
      ) : (
        <Check size={18} />
      )}
    </div>

    <div>
      <p className="text-sm font-bold">
        {notification.type === "error"
          ? "Something went wrong"
          : "MealShare"}
      </p>

      <p className="mt-0.5 text-sm text-slate-500">
        {notification.message}
      </p>
    </div>
  </div>
)}

{/* CLAIM CONFIRMATION MODAL */}
{selectedFood && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            AVAILABLE NOW
          </div>

          <h3 className="text-2xl font-black">
            Claim this meal?
          </h3>
        </div>

        <button
          onClick={() => setSelectedFood(null)}
          className="rounded-xl p-2 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <h4 className="font-black">
          {selectedFood.title}
        </h4>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700"><ShieldCheck size={13} /> Verified Community Donor</span>
          <span className="inline-flex items-center gap-1 text-amber-600"><Star size={14} fill="currentColor" /> 4.9</span>
        </div>

        <div className="mt-3 space-y-2 text-sm text-slate-500">
          <p className="flex items-center gap-2">
            <MapPin size={16} />
            {selectedFood.location}
          </p>

          <p className="flex items-center gap-2">
            <PackageCheck size={16} />
            {selectedFood.quantity}
          </p>

          <p className="flex items-center gap-2">
            <Clock3 size={16} />
            Available for{" "}
            {formatTimeLeft(selectedFood.expiresAt, now)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-sm font-bold text-emerald-800">
          Pickup instructions
        </p>

        <p className="mt-1 text-sm leading-5 text-emerald-700">
          Show your unique pickup code to the donor at the
          listed location before the food expires.
        </p>
      </div>

      <button
        onClick={() => handleClaim(selectedFood)}
        disabled={!isReceiver}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check size={18} />
        Confirm Claim
      </button>
    </div>
  </div>
)}

{/* PICKUP CODE MODAL */}
{claimedFood && (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
    <div className="my-auto w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-7 text-center shadow-2xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={28} />
      </div>

      <h3 className="mt-4 text-2xl font-black">
        Meal Claimed!
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        Show this verification code when you collect your food.
      </p>

      <div className="my-6 rounded-2xl bg-slate-950 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          Active Pickup Code
        </p>

        <p className="mt-2 break-all text-3xl font-black tracking-[0.12em] text-emerald-400 sm:text-4xl">
          {claimedFood.pickupCode}
        </p>
        <button
          onClick={copyPickupCode}
          className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
        >
          Copy Code
        </button>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-left text-sm">
        <p className="flex items-start gap-2">
          <MapPin
            size={17}
            className="mt-0.5 text-emerald-600"
          />

          <span>
            <strong>Pickup:</strong>{" "}
            {claimedFood.location}
          </span>
        </p>
      </div>

      <label className="mt-4 block text-left text-sm font-bold">
        Enter pickup code to complete
        <input
          value={verificationCode}
          onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
          placeholder="Enter 12-character code"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono tracking-wider outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
      </label>

      <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-left">
        <p className="text-sm font-black">Rate this pickup</p>
        <div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button key={star} onClick={() => setRating(star)} className={star <= rating ? "text-amber-400" : "text-slate-300"} aria-label={`${star} stars`}><Star size={23} fill="currentColor" /></button>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">{["Fresh", "Hygienic", "On Time"].map((tag) => <button key={tag} onClick={() => setFeedbackTag(tag)} className={`rounded-full border px-3 py-1 text-xs font-bold ${feedbackTag === tag ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>{tag}</button>)}</div>
        <button onClick={submitRating} className="mt-3 text-sm font-bold text-emerald-700">Submit feedback</button>
      </div>

      <button
        onClick={handleCompletePickup}
        className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white hover:bg-slate-800"
      >
        Complete Pickup
      </button>
    </div>
  </div>
)}
</div>
);
}

function ImpactMini({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FoodCard({
  food,
  now,
  statusLabel,
  statusClasses,
  canClaim,
  onClaim,
}) {
  const isAvailable = food.status === "available";
  const isUrgent = isAvailable && food.expiresAt - now < 30 * 60 * 1000;

  return (
    <article className={`group overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${isUrgent ? "animate-pulse border-rose-400" : "border-slate-200"}`}>
      <div className={`h-2 ${isUrgent ? "bg-rose-500" : "bg-emerald-500"}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${statusClasses[food.status]}`}
          >
            {isUrgent ? "URGENT PICKUP" : statusLabel[food.status]}
          </span>

          {isAvailable && (
            <span className="flex items-center gap-1 text-xs font-bold text-orange-600">
              <Clock3 size={14} />
              {formatTimeLeft(food.expiresAt, now)}
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-black leading-6">
          {food.title}
        </h3>

        <div className="mt-4 space-y-2.5 text-sm text-slate-500">
          <p className="flex items-start gap-2">
            <MapPin
              size={17}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            {food.location}
          </p>

          {isAvailable && <p className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{(food.distanceKm ?? 1.0).toFixed(1)} km away</p>}

          <p className="flex items-center gap-2">
            <PackageCheck
              size={17}
              className="text-emerald-600"
            />
            {food.quantity}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {food.dietary.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          disabled={!isAvailable || !canClaim}
          onClick={onClaim}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            isAvailable && canClaim
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {isAvailable && canClaim ? (
            <>
              <Heart size={17} />
              Claim This Meal
            </>
          ) : isAvailable && !canClaim ? (
            <>
              <ShieldCheck size={17} />
              Receiver Only
            </>
          ) : food.status === "claimed" ? (
            <>
              <Check size={17} />
              Already Claimed
            </>
          ) : food.status === "completed" ? (
            <>
              <Check size={17} />
              Pickup Completed
            </>
          ) : (
            <>
              <Clock3 size={17} />
              Food Expired
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function FormField({
  label,
  required,
  placeholder,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function MetricCard({ icon, value, label }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <p className="mt-5 text-4xl font-black">
        {value}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-500">
        {label}
      </p>
    </div>
  );
}

function AuthShell({ children, title, subtitle, icon }) {
  return (
    <main className="min-h-screen bg-[#f7faf7] px-4 py-8 text-slate-900 sm:flex sm:items-center sm:justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
          {icon}
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

function AuthInput({ label, type = "text", value, onChange, placeholder, required = true }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, token } = useAuth();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Receiver");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate("/dashboard", { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const authenticatedUser = await login(email.trim(), password, role);
      navigate(authenticatedUser?.role === "Donor" ? "/dashboard" : "/dashboard", { replace: true });
    } catch {
      // AuthContext already displays the backend error.
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      icon={<Utensils size={27} />}
      title="Welcome to MealShare"
      subtitle="Sign in to rescue or share food."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />

        <AuthInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
        />

        <div>
          <label className="mb-2 block text-sm font-bold">I want to</label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="Receiver">Receive food</option>
            <option value="Donor">Donate food</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="font-bold text-emerald-700 hover:text-emerald-800"
          >
            Create account
          </button>
        </p>
      </form>
    </AuthShell>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "claimant",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate("/dashboard", { replace: true });
  }, [token, navigate]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });

      toast.success("Account created successfully. Please sign in.");
      navigate("/login", {
        replace: true,
        state: { email: form.email.trim().toLowerCase() },
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Could not create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      icon={<UserPlus size={27} />}
      title="Create your account"
      subtitle="Join MealShare and help good food reach another table."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Full name"
          value={form.name}
          onChange={(value) => update("name", value)}
          placeholder="Your name"
        />

        <AuthInput
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) => update("email", value)}
          placeholder="you@example.com"
        />

        <AuthInput
          label="Password"
          type="password"
          value={form.password}
          onChange={(value) => update("password", value)}
          placeholder="At least 8 characters"
        />

        <AuthInput
          label="Confirm password"
          type="password"
          value={form.confirmPassword}
          onChange={(value) => update("confirmPassword", value)}
          placeholder="Enter the password again"
        />

        <div>
          <label className="mb-2 block text-sm font-bold">I want to</label>
          <select
            value={form.role}
            onChange={(event) => update("role", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="claimant">Receive food</option>
            <option value="donor">Donate food</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-bold text-emerald-700 hover:text-emerald-800"
          >
            Sign in
          </button>
        </p>
      </form>
    </AuthShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create-post" element={<ProtectedRoute allowedRoles={["Donor"]}><Dashboard initialTab="offer" /></ProtectedRoute>} />
          <Route path="/claims" element={<ProtectedRoute allowedRoles={["Receiver"]}><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
