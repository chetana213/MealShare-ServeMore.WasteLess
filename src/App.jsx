import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
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
  Utensils,
  Users,
  X,
} from "lucide-react";
import {
  analyticsApi,
  authApi,
  clearSession,
  foodApi,
  getApiError,
  getStoredUser,
  saveSession,
} from "./services/api";

function formatTimeLeft(expiresAt, now) {
  const difference = Math.max(0, expiresAt - now);

  const minutes = Math.floor(difference / 60000);
  const seconds = Math.floor((difference % 60000) / 1000);

  if (minutes <= 0 && seconds <= 0) {
    return "Expired";
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function displayRole(role) {
  return role === "donor" ? "Donor" : "NGO";
}

function App() {
  const [foods, setFoods] = useState([]);
  const [activeTab, setActiveTab] = useState("feed");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [notification, setNotification] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [claimedFood, setClaimedFood] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", role: "claimant" });

  const [form, setForm] = useState({
    title: "",
    quantity: "",
    location: "",
    expiry: "",
    dietary: [],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
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
    return foods.filter((food) => {
      const matchesSearch =
        food.title.toLowerCase().includes(search.toLowerCase()) ||
        food.location.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || food.status === statusFilter;

      const matchesDietary =
        !vegOnly || food.dietary.includes("Vegetarian");

      return matchesSearch && matchesStatus && matchesDietary;
    });
  }, [foods, search, statusFilter, vegOnly]);

  const activeDonations = foods.filter((food) => food.status === "available").length;

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
  };

  const loadFoods = async () => {
    setFoodsLoading(true);
    try {
      const response = await foodApi.getAll();
      setFoods(response.data.foods.map((food) => ({
        ...food,
        expiresAt: Number(food.expiresAt ?? new Date(food.expires_at).getTime()),
        dietary: Array.isArray(food.dietary) ? food.dietary : [],
        status: food.status?.toLowerCase() || "expired",
      })));
    } catch (error) {
      showNotification(getApiError(error, "Unable to load food listings."), "error");
    } finally {
      setFoodsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await analyticsApi.get();
      setAnalytics(response.data);
    } catch (error) {
      showNotification(getApiError(error, "Unable to load impact analytics."), "error");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadFoods();
  }, []);

  useEffect(() => {
    if (activeTab === "analytics") loadAnalytics();
  }, [activeTab]);

  useEffect(() => {
    if (!authUser) return;

    authApi.me()
      .then((response) => {
        const user = response.data.user;
        setAuthUser(user);
          saveSession(sessionStorage.getItem("mealshare_token"), user);
      })
      .catch(() => {
        clearSession();
        setAuthUser(null);
      });
  }, []);

  const openAuth = (mode = "login", selectedRole = "claimant") => {
    setAuthMode(mode);
    setAuthForm({
      name: "",
      email: "",
      password: "",
      role: selectedRole,
    });
    setAuthMessage(null);
    setAuthOpen(true);
    setMobileMenu(false);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthMessage(null);
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        await authApi.register({
          name: authForm.name.trim(),
          email: authForm.email.trim().toLowerCase(),
          password: authForm.password,
          role: authForm.role,
        });
      }

      const response = await authApi.login({
        email: authForm.email.trim().toLowerCase(),
        password: authForm.password,
      });
      const { token, user } = response.data;

      if (user.role !== authForm.role) {
        setAuthMessage({
          type: "error",
          message: `This account is registered as ${displayRole(user.role)}. Please use the ${displayRole(user.role)} login.`,
        });
        return;
      }

      saveSession(token, user);
      setAuthUser(user);
      setAuthOpen(false);
      showNotification(
        authMode === "register"
          ? `${displayRole(user.role)} account created successfully.`
          : `Signed in as ${displayRole(user.role)}.`
      );
    } catch (error) {
      const message = error.response?.status === 401 && authMode === "login"
        ? "Invalid email or password. If you don't have an account, please register first."
        : error.code === "ECONNABORTED"
          ? "The server is taking too long to respond. Please try again."
          : getApiError(error, "Unable to authenticate. Please check your connection and try again.");

      setAuthMessage({ type: "error", message });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setAuthUser(null);
    showNotification("You have been signed out.");
  };

  const openOffer = () => {
    if (!authUser) return openAuth("login", "donor");
    if (authUser.role !== "donor") return showNotification("Only donor accounts can publish food.", "error");
    setActiveTab("offer");
  };

  const openClaim = (food) => {
    if (!authUser) return openAuth("login", "claimant");
    if (authUser.role !== "claimant") return showNotification("Only NGO accounts can claim food.", "error");
    setSelectedFood(food);
  };

  const handleClaim = async (food) => {
    if (actionLoading || food.status !== "available") return;
    setActionLoading(true);
    try {
      const response = await foodApi.claim(food.id);
      setClaimedFood({ ...food, pickupCode: response.data.claim.pickup_code });
      setSelectedFood(null);
      await loadFoods();
      if (activeTab === "analytics") await loadAnalytics();
      showNotification(`${food.title} successfully claimed!`);
    } catch (error) {
      showNotification(getApiError(error, "Unable to claim this food."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (event) => {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.quantity.trim() ||
      !form.location.trim() ||
      !form.expiry
    ) {
      showNotification(
        "Please complete all required fields.",
        "error"
      );
      return;
    }

    const expiryDate = new Date(form.expiry).getTime();

    if (expiryDate <= Date.now()) {
      showNotification(
        "Expiry time must be in the future.",
        "error"
      );
      return;
    }

    setActionLoading(true);
    try {
      await foodApi.create({
        title: form.title,
        quantity: form.quantity,
        location: form.location,
        expires_at: new Date(form.expiry).toISOString(),
        dietary: form.dietary,
      });
      setForm({ title: "", quantity: "", location: "", expiry: "", dietary: [] });
      await loadFoods();
      showNotification("Food listing published successfully!");
      setActiveTab("feed");
    } catch (error) {
      showNotification(getApiError(error, "Unable to publish this food."), "error");
    } finally {
      setActionLoading(false);
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
    expired: "EXPIRED",
  };

  const statusClasses = {
    available:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    claimed:
      "bg-amber-50 text-amber-700 border-amber-200",
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

            <button
              onClick={openOffer}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === "offer"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Offer Food
            </button>

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
            {authUser ? (
              <button
                onClick={handleLogout}
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:flex"
              >
                <Users size={17} />
                {displayRole(authUser.role)} · Sign out
              </button>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  onClick={() => openAuth("login", "claimant")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  NGO Login
                </button>
                <button
                  onClick={() => openAuth("login", "donor")}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Donor Login
                </button>
              </div>
            )}

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

              <button
                onClick={() => {
                  openOffer();
                  setMobileMenu(false);
                }}
                className="rounded-xl p-3 text-left font-semibold hover:bg-slate-100"
              >
                Offer Food
              </button>

              <button
                onClick={() => {
                  setActiveTab("analytics");
                  setMobileMenu(false);
                }}
                className="rounded-xl p-3 text-left font-semibold hover:bg-slate-100"
              >
                Impact Analytics
              </button>

              {!authUser ? (
                <>
                  <button
                    onClick={() => openAuth("login", "claimant")}
                    className="rounded-xl border border-slate-200 p-3 text-left font-bold text-slate-700 hover:bg-slate-50"
                  >
                    NGO Login
                  </button>
                  <button
                    onClick={() => openAuth("login", "donor")}
                    className="rounded-xl bg-emerald-600 p-3 text-left font-bold text-white hover:bg-emerald-700"
                  >
                    Donor Login
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenu(false);
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-left font-bold text-slate-700 hover:bg-slate-50"
                >
                  Sign Out ({displayRole(authUser.role)})
                </button>
              )}
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
                Connect surplus food with NGOs and local communities
                before it expires. Every claim is one less meal
                wasted.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ImpactMini value={analytics?.totalMealsSaved ?? "—"} label="Meals Saved" />
              <ImpactMini value={analytics?.totalFoodListingsClaimed ?? "—"} label="Listings Claimed" />
              <ImpactMini value={foods.length === 0 && foodsLoading ? "—" : activeDonations} label="Active Donations" />
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

          <TabButton
            active={activeTab === "offer"}
            onClick={openOffer}
            icon={<Plus size={17} />}
            label="Offer Food"
          />

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
                  NGOs can claim surplus food before the timer runs out.
                </p>
              </div>

              <button
                onClick={openOffer}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
              >
                <Plus size={18} />
                Offer Surplus Food
              </button>
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
            </div>

            {/* FOOD CARDS */}
            {foodsLoading && (
              <p className="text-sm font-semibold text-slate-500">Loading food listings...</p>
            )}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredFoods.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  now={now}
                  statusLabel={statusLabel}
                  statusClasses={statusClasses}
                  onClaim={() => {
                    if (food.status === "available") {
                      openClaim(food);
                    }
                  }}
                />
              ))}
            </div>

            {!foodsLoading && filteredFoods.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Utensils className="mx-auto mb-3 text-slate-400" size={35} />
                <h3 className="font-bold">No food found</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or filters.
                </p>
              </div>
            )}
          </section>
        )}

        {/* OFFER */}
        {activeTab === "offer" && (
          <section className="mx-auto max-w-3xl">
            <div className="mb-6">
              <p className="text-sm font-bold text-emerald-600">
                DONOR MODE
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">
                Offer surplus food
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
                    Available Until
                    <span className="text-rose-500"> *</span>
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
  disabled={actionLoading}
  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
>
  <PackageCheck size={19} />
  {actionLoading ? "Publishing..." : "Publish Food Listing"}
</button>
</div>
</form>
</section>
)}

{/* ANALYTICS */}
{activeTab === "analytics" && (
<section>
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
      value={analyticsLoading ? "…" : analytics?.totalMealsSaved ?? "0"}
      label="Total Meals Saved"
    />

    <MetricCard
      icon={<Leaf />}
      value={analyticsLoading ? "…" : analytics?.totalFoodListingsClaimed ?? "0"}
      label="Food Listings Claimed"
    />

    <MetricCard
      icon={<PackageCheck />}
      value={foodsLoading ? "…" : activeDonations}
      label="Active Donations"
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
          {(analytics?.recentFoodRescues || []).map((item) => (
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
                  {new Date(item.claimedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
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
{notification && !authOpen && (
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

{/* AUTH MODAL */}
{authOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <form onSubmit={handleAuth} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
         <p className="text-sm font-bold text-emerald-600">
  {displayRole(authForm.role)} ACCOUNT
</p>
          <h3 className="mt-1 text-2xl font-black">
            {authMode === "login"
              ? `Welcome back, ${displayRole(authForm.role)}`
              : `Create your ${displayRole(authForm.role)} account`}
          </h3>
          {authMessage && (
            <div
              className={`mt-3 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                authMessage.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {authMessage.message}
            </div>
          )}
        </div>
        <button type="button" onClick={() => { setAuthOpen(false); setAuthMessage(null); }} className="rounded-xl p-2 hover:bg-slate-100">
          <X size={20} />
        </button>
      </div>

      <div className="mb-5 flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
        {["login", "register"].map((mode) => (
          <button
            type="button"
            key={mode}
            onClick={() => { setAuthMode(mode); setAuthMessage(null); }}
            className={`flex-1 rounded-lg px-3 py-2 capitalize ${authMode === mode ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {authMode === "register" && (
          <FormField label="Name" required placeholder="Your name" value={authForm.name} onChange={(name) => setAuthForm({ ...authForm, name })} />
        )}
        <FormField label="Email" required placeholder="you@example.com" value={authForm.email} onChange={(email) => setAuthForm({ ...authForm, email })} />
        <div>
          <label className="mb-2 block text-sm font-bold">Password <span className="text-rose-500">*</span></label>
          <input
            type="password"
            minLength="8"
            required
            value={authForm.password}
            onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>
       
      </div>

      <button disabled={authLoading} type="submit" className="mt-6 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700">
        {authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
      </button>

      <p className="mt-4 text-center text-sm text-slate-500">
        {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthMessage(null); }}
          className="font-bold text-emerald-700 hover:text-emerald-800"
        >
          {authMode === "login" ? "Register" : "Sign In"}
        </button>
      </p>
    </form>
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
          listed location before the food expires. Only claim food you can collect on time.
        </p>
      </div>

      <button
        onClick={() => handleClaim(selectedFood)}
        disabled={actionLoading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700"
      >
        <Check size={18} />
        {actionLoading ? "Claiming..." : "Confirm Claim"}
      </button>
    </div>
  </div>
)}

{/* PICKUP CODE MODAL */}
{claimedFood && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
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
          Pickup Code
        </p>

        <p className="mt-2 break-all text-4xl font-black tracking-[0.15em] text-emerald-400 sm:text-5xl">
          {claimedFood.pickupCode}
        </p>
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

      <button
        onClick={() => setClaimedFood(null)}
        className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white hover:bg-slate-800"
      >
        Done
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
  onClaim,
}) {
  const isAvailable = food.status === "available";

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="h-2 bg-emerald-500" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-black tracking-wide ${statusClasses[food.status]}`}
          >
            {statusLabel[food.status]}
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
          disabled={!isAvailable}
          onClick={onClaim}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            isAvailable
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {isAvailable ? (
            <>
              <Heart size={17} />
              Claim This Meal
            </>
          ) : food.status === "claimed" ? (
            <>
              <Check size={17} />
              Already Claimed
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

export default App;
