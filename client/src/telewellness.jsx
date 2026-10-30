import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  Apple,
  ArrowRight,
  CalendarDays,
  Camera,
  CameraOff,
  Check,
  Clock3,
  Dumbbell,
  Flower2,
  Heart,
  HeartPulse,
  Leaf,
  Mail,
  Menu,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Video,
  Wind,
  X,
} from "lucide-react";
import axios from "axios";
import { io } from "socket.io-client";
import "./telewellness.css";

const api = axios.create({ baseURL: "/api", timeout: 6000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tw-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const currentYear = new Date().getFullYear();
const currentDate = new Date().toISOString().slice(0, 10);
// Supplied fixed link: used only as a documented fallback. Appointment payments are created
// through the backend payment-link endpoint so verification can be associated with the patient.
const BASIC_CONSULTATION_PAYMENT_LINK = "https://rzp.io/rzp/s6BX7fFX";
function isAppointmentJoinable(appointment, now = new Date()) {
  if (!appointment || appointment.status !== "accepted") return false;
  const appointmentDate = new Date(appointment.date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(appointment.time || "");
  if (Number.isNaN(appointmentDate.getTime()) || !timeMatch) return false;
  appointmentDate.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  const duration = Number(appointment.planDuration || 15);
  const opens = new Date(appointmentDate.getTime() - 15 * 60 * 1000);
  const closes = new Date(appointmentDate.getTime() + duration * 60 * 1000 + 15 * 60 * 1000);
  return now >= opens && now <= closes;
}
// Change this URL to replace the TeleWellness demo video in the future.
const TELEWELLNESS_DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=0zYjgZD2aG8";
const TELEWELLNESS_DEMO_VIDEO_ID = "0zYjgZD2aG8";
// Change this URL/video ID to replace the meditation video in the future.
const MEDITATION_VIDEO_URL = "https://www.youtube.com/watch?v=Aakkp3S-nNA";
const MEDITATION_VIDEO_ID = "Aakkp3S-nNA";
const YOGA_VIDEO_URL = "https://www.youtube.com/watch?v=tB_My3qzc5M";
const YOGA_VIDEO_ID = "tB_My3qzc5M";
const MEDITATION_PAYMENT_LINK = "https://rzp.io/rzp/1rWo8z80";
const categories = ["Nutrition", "Yoga", "Meditation", "Exercise"];
const images = {
  Nutrition: "photo-1490645935967-10de6ba17061",
  Yoga: "photo-1544367567-0f2fcb009e0b",
  Meditation: "photo-1506126613408-eca07ce68773",
  Exercise: "photo-1517836357463-d25dfeac3438",
};
const sampleContent = [
  {
    _id: "demo-content-1",
    title: "A gentler way to build a balanced plate",
    category: "Nutrition",
    description:
      "Simple, flexible ideas for making nourishing choices part of your regular routine.",
  },
  {
    _id: "demo-content-2",
    title: "Easy morning mobility",
    category: "Yoga",
    description:
      "A low-impact sequence of stretches you can adapt to your comfort and ability.",
  },
  {
    _id: "demo-content-3",
    title: "A 10-minute mindful pause",
    category: "Meditation",
    description:
      "A beginner-friendly breathing practice for moments when you need a reset.",
  },
  {
    _id: "demo-content-4",
    title: "Make movement fit your day",
    category: "Exercise",
    description:
      "Practical ways to add comfortable, consistent activity to an ordinary day.",
  },
  {
    _id: "demo-content-5",
    title: "Eating well on busy weekdays",
    category: "Nutrition",
    description: "A simple planning framework to make everyday meals easier.",
  },
  {
    _id: "demo-content-6",
    title: "Wind down with a body scan",
    category: "Meditation",
    description:
      "A guided relaxation exercise to help you notice tension and settle in.",
  },
];
const sampleProfessionals = [
  {
    _id: "pro-1",
    name: "Dr. Maya Chen",
    specialty: "Family Wellness",
    experience: "12 years",
    bio: "A primary care professional focused on preventive health, sustainable habits, and whole-person care.",
  },
  {
    _id: "pro-2",
    name: "Dr. Elias Morgan",
    specialty: "Lifestyle Medicine",
    experience: "9 years",
    bio: "Works with people to build realistic routines around movement, sleep, and everyday wellbeing.",
  },
  {
    _id: "pro-3",
    name: "Dr. Amara Okafor",
    specialty: "Nutrition & Prevention",
    experience: "11 years",
    bio: "Offers practical, culturally responsive nutrition education and preventive wellness guidance.",
  },
];

function useUser() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tw-user"));
    } catch {
      return null;
    }
  });
  function signIn(next, token) {
    localStorage.setItem("tw-user", JSON.stringify(next));
    if (token) localStorage.setItem("tw-token", token);
    else localStorage.removeItem("tw-token");
    setUser(next);
  }
  function signOut() {
    localStorage.removeItem("tw-user");
    localStorage.removeItem("tw-token");
    setUser(null);
  }
  return { user, signIn, signOut };
}

function Shell({ user, signOut, children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const links = [
    ["Home", "/"],
    ["Professionals", "/professionals"],
    ["Consult", "/appointments"],
    ["Wellness", "/wellness"],
    ["Fees", "/fees"],
    ["About", "/about"],
  ];
  return (
    <>
      <header className="topbar">
        <div className="wrap nav">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <HeartPulse size={20} />
            </span>
            TeleWellness
          </Link>
          <nav className={`nav-links ${open ? "open" : ""}`}>
            {links.map(([label, path]) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <button
                  className="btn btn-quiet btn-small"
                  onClick={() =>
                    navigate(user.role === "admin" ? "/admin" : "/dashboard")
                  }
                >
                  {user.name.split(" ")[0]}
                </button>
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    signOut();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline btn-small" to="/login">
                  Login
                </Link>
                <Link className="btn btn-primary btn-small" to="/register">
                  Register
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>
      {children}
      <footer className="footer">
        <div className="wrap">
          <div className="footer-top">
            <div>
              <Link to="/" className="brand footer-brand">
                <span className="brand-mark">
                  <Activity size={18} />
                </span>
                TeleWellness
              </Link>
              <p>
                Thoughtful conversations and practical guidance for a healthier
                everyday life.
              </p>
            </div>
            <div className="footer-links">
              <Link to="/professionals">Professionals</Link>
              <Link to="/wellness">Wellness library</Link>
              <Link to="/about">About</Link>
              <Link to="/contact">Contact</Link>
            </div>
          </div>
          <div className="footer-bottom">
            Educational wellness information is not emergency care and does not
            replace professional diagnosis or treatment. © {currentYear}{" "}
            TeleWellness.
          </div>
        </div>
      </footer>
    </>
  );
}

function Intro({ eyebrow, title, children }) {
  return (
    <section className="page-intro">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
    </section>
  );
}
function Disclaimer() {
  return (
    <div className="disclaimer">
      <strong>A note about care:</strong> TeleWellness provides educational
      wellness information and facilitates consultations with healthcare
      professionals. It does not provide medicine prescriptions, emergency
      medical services, or replace professional medical diagnosis and treatment.
      For urgent symptoms, contact local emergency services.
    </div>
  );
}

function Home() {
  const features = [
    [
      "Nutrition",
      Apple,
      "/nutrition",
      "Learn healthy eating and nutrition practices.",
    ],
    [
      "Meditation",
      Wind,
      "/meditation",
      "Explore mindfulness and relaxation techniques.",
    ],
    [
      "Yoga",
      Flower2,
      "/yoga",
      "Learn beginner-friendly yoga and stretching practices.",
    ],
    [
      "Exercise",
      Dumbbell,
      "/exercise",
      "Discover healthy movement and lifestyle activities.",
    ],
  ];
  const steps = [
    ["01", "Choose a Professional", "Browse professionals and find a good fit for your needs."],
    ["02", "Book a Consultation", "Choose an available time for an online conversation."],
    ["03", "Join a Video Consultation", "Meet online from a place that feels comfortable."],
    ["04", "Receive Wellness Guidance", "Discuss practical guidance for your everyday wellbeing."],
  ];
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow">A more thoughtful kind of care</span>
            <h1>Healthcare Beyond Medicine</h1>
            <p>
              Connect with healthcare professionals and discover better ways to
              support your health through nutrition, movement, mindfulness, and
              healthy lifestyle practices.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/professionals">
                Book a Consultation <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-outline" to="/wellness">
                Explore Wellness
              </Link>
            </div>
            <div className="hero-note">
              <ShieldCheck size={16} /> Professional conversations. Practical
              everyday guidance.
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <Heading
            eyebrow="Small steps, supported"
            title="Wellness that meets you where you are"
          >
            Explore approachable ideas for caring for your whole self, one day
            at a time.
          </Heading>
          <div className="features">
            {features.map(([title, Icon, href, text]) => (
              <Link className="feature" to={href} key={title}>
                <span className="feature-icon">
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section how">
        <div className="wrap">
          <Heading eyebrow="Simple by design" title="How it works">
            Thoughtful care can start with one conversation.
          </Heading>
          <div className="steps">
            {steps.map(([number, title, description]) => (
              <div className="step" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section demo-video-section">
        <div className="wrap">
          <Heading eyebrow="TeleWellness walkthrough" title="How TeleWellness Works">
            Watch this demo to understand how TeleWellness helps patients access online consultations and wellness guidance.
          </Heading>
          <div className="demo-video-layout">
            <div className="demo-video-frame">
              <iframe
                src={`https://www.youtube.com/embed/${TELEWELLNESS_DEMO_VIDEO_ID}`}
                title="How TeleWellness Works demo video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="demo-video-copy">
              <p>
                Learn how patients can get started, book and join consultations,
                explore wellness resources, and review their payment status.
              </p>
              <a
                className="btn btn-outline"
                href={TELEWELLNESS_DEMO_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch on YouTube <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="consult-banner">
            <div>
              <span className="eyebrow">Care, wherever you are</span>
              <h2>A real conversation can be a good first step.</h2>
              <p>
                Meet online with a healthcare professional and talk through your
                wellbeing goals.
              </p>
              <Link className="btn btn-light" to="/professionals">
                Join Online Consultation <Video size={16} />
              </Link>
            </div>
            <div className="consult-photo" />
          </div>
        </div>
      </section>
      <section className="section disclaimer-section">
        <div className="wrap">
          <Disclaimer />
        </div>
      </section>
    </>
  );
}
function FeeStructure({ user }) {
  const nav = useNavigate();
  const [plans, setPlans] = useState([
    { id: 'basic', name: 'Basic Consultation', price: 99, duration: 15, description: '15-minute session' },
    { id: 'meditation', name: 'Meditation Session', price: 49, duration: 15, description: '15-minute session' },
    { id: 'yoga', name: 'Yoga Session', price: 79, duration: 30, description: '30-minute session' },
    { id: 'wellness', name: 'Wellness Package', price: 199, duration: 60, description: 'One basic consultation, one meditation session, and one yoga session' },
  ]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");

  useEffect(() => {
    api.get('/fees')
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) setPlans(data);
      })
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  function bookPlan(plan) {
    if (!user) {
      nav('/login');
      return;
    }
    setSelectedPlanId(plan.id);
    setPaymentStatus('Unpaid');
    nav(`/professionals?plan=${encodeURIComponent(plan.id)}`);
  }

  return (
    <>
      <Intro eyebrow="Transparent wellness pricing" title="Fee Structure">
        Choose a consultation or package and complete payment securely after booking.
      </Intro>
      <section className="page-body">
        <div className="wrap">
          {selectedPlan && (
            <div className="fee-selection">
              <div><strong>Selected plan:</strong> {selectedPlan.name}</div>
              <div><strong>Fee:</strong> ₹{selectedPlan.price}</div>
              <span className={`payment-badge ${paymentStatus === "Paid" ? "paid" : "unpaid"}`}>{paymentStatus}</span>
            </div>
          )}
          <div className="fee-grid">
            {plans.map((plan) => (
              <article className="fee-card" key={plan.id}>
                <span className="eyebrow">{plan.duration} minutes</span>
                <h2>{plan.name}</h2>
                <strong className="fee-price">₹{plan.price}</strong>
                <p>{plan.description}</p>
                <button className="btn btn-primary full" onClick={() => bookPlan(plan)}>
                  Book Now <CalendarDays size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Heading({ eyebrow, title, children }) {
  return (
    <div className="heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function WellnessVideoLibrary({ selectedCategory, user }) {
  const [meditationPayment, setMeditationPayment] = useState({
    status: "Unpaid",
    message: "",
    appointmentId: null,
    busy: false,
  });

  useEffect(() => {
    if (!user || user.demo || !localStorage.getItem("tw-token")) return;
    api.get("/appointments")
      .then(({ data }) => {
        const meditation = Array.isArray(data)
          ? data.find((appointment) =>
              appointment.planId === "meditation" ||
              appointment.planName === "Meditation Session")
          : null;
        if (!meditation) return;
        const status = meditation.payment?.status;
        setMeditationPayment((current) => ({
          ...current,
          appointmentId: meditation._id,
          status: status === "paid"
            ? "Paid"
            : status === "pending"
              ? "Processing"
              : status === "failed"
                ? "Payment Failed"
                : status === "cancelled"
                  ? "Cancelled"
                  : "Unpaid",
        }));
      })
      .catch(() => {});
  }, [user]);

  async function payForMeditation() {
    if (!user || user.demo || !localStorage.getItem("tw-token")) {
      window.open(MEDITATION_PAYMENT_LINK, "_blank", "noopener,noreferrer");
      setMeditationPayment((current) => ({
        ...current,
        status: "Unpaid",
        message: "Payment link opened. Sign in and book to verify payment against your account.",
      }));
      return;
    }
    if (!meditationPayment.appointmentId) {
      setMeditationPayment((current) => ({
        ...current,
        message: "Book a Meditation Session first so payment can be linked to your appointment.",
      }));
      return;
    }
    setMeditationPayment((current) => ({ ...current, busy: true, message: "" }));
    try {
      const { data } = await api.post("/payments/payment-link/meditation", {
        appointmentId: meditationPayment.appointmentId,
      });
      if (!data?.shortUrl) throw new Error("The backend returned no payment link.");
      window.open(data.shortUrl, "_blank", "noopener,noreferrer");
      setMeditationPayment((current) => ({
        ...current,
        status: "Processing",
        message: "Complete payment in Razorpay. Status changes to Paid only after backend verification.",
      }));
    } catch (error) {
      setMeditationPayment((current) => ({
        ...current,
        status: "Unpaid",
        message: error.response?.data?.message || error.message || "Could not start Meditation Session payment.",
      }));
    } finally {
      setMeditationPayment((current) => ({ ...current, busy: false }));
    }
  }

  const videos = [
    {
      category: "All",
      title: "How TeleWellness Works",
      description: "Watch this demo to understand how TeleWellness helps patients access online consultations and wellness guidance.",
      url: TELEWELLNESS_DEMO_VIDEO_URL,
      id: TELEWELLNESS_DEMO_VIDEO_ID,
    },
    {
      category: "Meditation",
      title: "Meditation & Relaxation",
      description: "Take a mindful break with guided meditation to relax your mind, reduce everyday stress, and support your overall well-being.",
      url: MEDITATION_VIDEO_URL,
      id: MEDITATION_VIDEO_ID,
    },
    {
      category: "Yoga",
      title: "Yoga & Physical Wellness",
      description: "Explore yoga practices that can help improve flexibility, support relaxation, and encourage a healthy lifestyle.",
      url: YOGA_VIDEO_URL,
      id: YOGA_VIDEO_ID,
    },
  ];
  const visibleVideos = selectedCategory === "All"
    ? videos
    : videos.filter((video) => video.category === selectedCategory);

  if (!visibleVideos.length) return null;

  return (
    <section className="wellness-video-library" aria-label="Wellness video library">
      <Heading eyebrow="Guided wellness videos" title="Watch, learn, and practice">
        Short videos to support relaxation, physical wellness, and your TeleWellness experience.
      </Heading>
      <div className="wellness-video-grid">
        {visibleVideos.map((video) => (
          <article className="wellness-video-card" key={video.id}>
            <div className="demo-video-frame wellness-video-frame">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}`}
                title={`${video.title} YouTube video`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="wellness-video-copy">
              <h3>{video.title}</h3>
              <p>{video.description}</p>
              <a className="text-link" href={video.url} target="_blank" rel="noopener noreferrer">
                Watch on YouTube <ArrowRight size={14} />
              </a>
              {video.category === "Meditation" && (
                <div className="meditation-payment-panel">
                  <span className={`payment-badge ${meditationPayment.status === "Paid" ? "paid" : meditationPayment.status === "Payment Failed" || meditationPayment.status === "Cancelled" ? "failed" : "unpaid"}`}>
                    {meditationPayment.status}
                  </span>
                  {meditationPayment.status !== "Paid" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      disabled={meditationPayment.busy}
                      onClick={payForMeditation}
                    >
                      {meditationPayment.busy ? "Opening Razorpay..." : "Pay for Meditation Session"}
                    </button>
                  )}
                  {!meditationPayment.appointmentId && user && !user.demo && (
                    <Link className="text-link" to="/fees">
                      Book a Meditation Session <ArrowRight size={14} />
                    </Link>
                  )}
                  {meditationPayment.message && (
                    <span className="payment-message">{meditationPayment.message}</span>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Wellness({ fixedCategory, user }) {
  const { category } = useParams();
  const categoryName = fixedCategory || category;
  const defaultCategory = categoryName
    ? categoryName[0].toUpperCase() + categoryName.slice(1).toLowerCase()
    : "All";
  const [selection, setSelection] = useState({
    route: categoryName,
    category: defaultCategory,
  });
  const selected =
    selection.route === categoryName ? selection.category : defaultCategory;
  const [items, setItems] = useState(sampleContent);
  function chooseCategory(next) {
    setSelection({ route: categoryName, category: next });
  }
  useEffect(() => {
    api
      .get("/wellness")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) setItems(data);
      })
      .catch(() => {});
  }, []);
  const filtered =
    selected === "All"
      ? items
      : items.filter(
          (item) => item.category?.toLowerCase() === selected.toLowerCase(),
        );
  return (
    <>
      <Intro
        eyebrow="The wellness library"
        title={
          selected === "All"
            ? "Ideas for a healthier everyday"
            : `${selected} & everyday wellbeing`
        }
      >
        Educational resources to explore at your own pace. Ask a professional
        for guidance tailored to your needs.
      </Intro>
      <section className="page-body">
        <div className="wrap">
          <div className="filters">
            <button
              className={selected === "All" ? "chosen" : ""}
              onClick={() => chooseCategory("All")}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                key={item}
                className={selected === item ? "chosen" : ""}
                onClick={() => chooseCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <WellnessVideoLibrary selectedCategory={selected} user={user} />
          <div className="resource-grid">
            {filtered.map((item) => (
              <article className="resource" key={item._id || item.title}>
                <img
                  src={
                    item.imageUrl ||
                    `https://images.unsplash.com/${images[item.category] || images.Nutrition}?auto=format&fit=crop&w=700&q=80`
                  }
                  alt=""
                />
                <div className="resource-body">
                  <span>
                    {item.category} · {item.duration || "Wellness guide"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <a
                    className="text-link"
                    href={item.videoUrl || "#"}
                    target={item.videoUrl ? "_blank" : undefined}
                    rel="noreferrer"
                  >
                    {item.videoUrl ? "Watch resource" : "Explore guide"}{" "}
                    <ArrowRight size={14} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <div className="disclaimer-space">
            <Disclaimer />
          </div>
        </div>
      </section>
    </>
  );
}

function Professionals() {
  const [list, setList] = useState(sampleProfessionals);
  const [query, setQuery] = useState("");
  useEffect(() => {
    api
      .get("/professionals")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) setList(data);
      })
      .catch(() => {});
  }, []);
  const filtered = list.filter((person) =>
    `${person.name} ${person.specialty}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <Intro eyebrow="Meet your care team" title="Professionals who listen">
        Connect with healthcare professionals for preventive, whole-person
        guidance.
      </Intro>
      <section className="page-body">
        <div className="wrap">
          <input
            className="search"
            placeholder="Search by name or focus"
            aria-label="Search professionals"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="professional-grid">
            {filtered.map((person) => (
              <ProfessionalCard key={person._id} person={person} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
function ProfessionalCard({ person }) {
  const [searchParams] = useSearchParams();
  const planQuery = searchParams.get("plan");
  const profileHref = planQuery ? `/professionals/${person._id}?plan=${encodeURIComponent(planQuery)}` : `/professionals/${person._id}`;
  return (
    <article className="professional">
      <div className="avatar">
        {person.name
          .split(" ")
          .filter(Boolean)
          .slice(-2)
          .map((part) => part[0])
          .join("")}
      </div>
      <h3>{person.name}</h3>
      <span className="specialty">
        {person.specialty || "Wellness professional"}
      </span>
      <p>{person.bio}</p>
      <div className="meta">
        <span>
          <Clock3 size={13} /> {person.experience || "Experienced professional"}
        </span>
        <Link className="text-link" to={profileHref}>
          View profile <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}

function Auth({ register, signIn }) {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "patient",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(
        `/auth/${register ? "register" : "login"}`,
        form,
      );
      signIn(data.user, data.token);
      nav(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to reach the service. Start the API or use a demo role below.",
      );
    } finally {
      setBusy(false);
    }
  }
  function demo(role) {
    const names = {
      patient: "Jordan Lee",
      professional: "Dr. Maya Chen",
      admin: "TeleWellness Admin",
    };
    signIn({
      _id: `demo-${role}`,
      name: names[role],
      email: `demo-${role}@telewellness.local`,
      role,
      demo: true,
    });
    nav(role === "admin" ? "/admin" : "/dashboard");
  }
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <span className="eyebrow">Care with a wider view</span>
        <h1>Support for the whole of you.</h1>
        <p>
          Connect with healthcare professionals and find practical, personalized
          guidance for everyday wellbeing.
        </p>
      </aside>
      <section className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p>
            {register
              ? "Start a conversation about your wellbeing."
              : "Sign in to continue to your TeleWellness space."}
          </p>
          {register && (
            <>
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <div className="field-row">
                <Field label="Phone">
                  <input
                    name="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </Field>
                <Field label="Account type">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="patient">Patient</option>
                    <option value="professional">
                      Healthcare professional
                    </option>
                  </select>
                </Field>
              </div>
            </>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              minLength="8"
              autoComplete={register ? "new-password" : "current-password"}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary full" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}{" "}
            <ArrowRight size={15} />
          </button>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to TeleWellness?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
          <div className="demo-box">
            <p>
              Explore the interface without database setup. Demo activity stays
              in this browser.
            </p>
            {["patient", "professional", "admin"].map((role) => (
              <button
                type="button"
                className="btn btn-quiet btn-small"
                key={role}
                onClick={() => demo(role)}
              >
                {role[0].toUpperCase() + role.slice(1)} demo
              </button>
            ))}
          </div>
        </form>
      </section>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Dashboard({ user }) {
  const [paymentBusy, setPaymentBusy] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [appointments, setAppointments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tw-appointments") || "[]");
    } catch {
      return [];
    }
  });
  const [activities, setActivities] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tw-activities")) || {};
    } catch {
      return {};
    }
  });
  const [noteAppointment, setNoteAppointment] = useState("");
  const [notes, setNotes] = useState("");
  const [guidance, setGuidance] = useState("");
  const [recommendedCategories, setRecommendedCategories] = useState([]);
  const [noteMessage, setNoteMessage] = useState("");
  const [previousConsultationId, setPreviousConsultationId] = useState("");
  const [previousConsultation, setPreviousConsultation] = useState(null);
  const professional = user?.role === "professional";
  useEffect(() => {
    if (!localStorage.getItem("tw-token")) return;
    api
      .get("/appointments")
      .then(({ data }) => setAppointments(data))
      .catch(() => {});
  }, []);
  function toggleActivity(name) {
    const updated = { ...activities, [name]: !activities[name] };
    setActivities(updated);
    localStorage.setItem("tw-activities", JSON.stringify(updated));
  }
  async function changeStatus(appointment, status) {
    if (!String(appointment._id).startsWith("local-")) {
      try {
        await api.put(`/appointments/${appointment._id}`, { status });
      } catch {
        return;
      }
    }
    const updated = appointments.map((item) =>
      item._id === appointment._id ? { ...item, status } : item,
    );
    setAppointments(updated);
    localStorage.setItem("tw-appointments", JSON.stringify(updated));
  }
  async function payForAppointment(appointment) {
    if (!user || user.demo || String(appointment._id).startsWith("local-")) {
      setPaymentMessage("Sign in with a patient account that is linked to this appointment to enable payment.");
      return;
    }
    if (user.role !== "patient") {
      setPaymentMessage("Only patients can initiate payment for their appointment.");
      return;
    }
    setPaymentBusy(appointment._id)
    setPaymentMessage("")
    try {
      const isBasic = !appointment.planId || appointment.planId === "basic" || appointment.planName === "Basic Consultation";
      if (isBasic) {
        window.open(BASIC_CONSULTATION_PAYMENT_LINK, "_blank", "noopener,noreferrer");
        setPaymentMessage("Payment link opened. Payment must be verified by the backend before this appointment can become Paid.");
        setPaymentBusy("");
        return;
      }
      const scriptLoaded = await new Promise((resolve) => {
        if (window.Razorpay) return resolve(true)
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
      })
      if (!scriptLoaded) throw new Error("Could not load Razorpay Checkout. Check your internet connection and browser ad/script blocking settings.")

      let data;
      try {
        const response = await api.post("/payments/orders", { appointmentId: appointment._id });
        data = response.data;
      } catch (orderError) {
        throw new Error(orderError.response?.data?.message || orderError.message || "The backend could not create the ₹99 Razorpay order.");
      }
      if (!data?.orderId || !data?.keyId || Number(data.amount) !== 9900) {
        throw new Error(data?.message || "The backend returned an invalid Razorpay order. Expected ₹99 and 9900 paise.");
      }
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.orderId,
        prefill: { name: user.name, email: user.email },
        handler: async (response) => {
          try {
            const verified = await api.post("/payments/verify", {
              appointmentId: appointment._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            const updatedPayment = verified.data
            setAppointments((current) => current.map((item) => item._id === appointment._id
              ? { ...item, payment: { status: "paid", amount: data.amount / 100, currency: data.currency, paymentId: updatedPayment.paymentId, paymentDate: updatedPayment.paymentDate, transactionId: updatedPayment.paymentId } }
              : item))
            setPaymentMessage("Payment verified successfully.")
          } catch (error) {
            setPaymentMessage(error.response?.data?.message || "Payment verification failed.")
          } finally {
            setPaymentBusy("")
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              await api.post("/payments/failure", { appointmentId: appointment._id, reason: "Checkout cancelled by patient" })
              setAppointments((current) => current.map((item) => item._id === appointment._id
                ? { ...item, payment: { ...item.payment, status: "cancelled" } }
                : item))
              setPaymentMessage("Payment cancelled. No payment was confirmed.")
            } catch {}
            setPaymentBusy("")
          },
        },
      })
      checkout.on("payment.failed", async (response) => {
        await api.post("/payments/failure", { appointmentId: appointment._id, reason: response.error?.description || "Payment failed", status: "failed" })
        setAppointments((current) => current.map((item) => item._id === appointment._id
          ? { ...item, payment: { ...item.payment, status: "failed" } }
          : item))
        setPaymentMessage("Payment failed. You can try again.")
        setPaymentBusy("")
      })
      checkout.open()
    } catch (error) {
      setPaymentMessage(error.response?.data?.message || error.message || "Could not start payment.")
      setPaymentBusy("")
    }
  }
  async function saveGuidance(event, appointment) {
    event.preventDefault();
    setNoteMessage("");
    try {
      if (user?.demo || String(appointment._id).startsWith("local-")) {
        const saved = JSON.parse(localStorage.getItem("tw-consultation-notes") || "{}");
        saved[appointment._id] = { notes, guidance, recommendedCategories };
        localStorage.setItem("tw-consultation-notes", JSON.stringify(saved));
      } else {
        await api.post(`/consultations/${appointment._id}/notes`, {
          guidance,
          notes,
          recommendedCategories,
        });
      }
      setNoteMessage("General wellness guidance saved.");
    } catch (error) {
      setNoteMessage(error.response?.data?.message || "Could not save guidance.");
    }
  }
  async function viewPrevious(appointment) {
    if (previousConsultationId === appointment._id) {
      setPreviousConsultationId("");
      return;
    }
    setPreviousConsultationId(appointment._id);
    if (user?.demo || String(appointment._id).startsWith("local-")) {
      const saved = JSON.parse(localStorage.getItem("tw-consultation-notes") || "{}");
      setPreviousConsultation(saved[appointment._id] || null);
      return;
    }
    try {
      const { data } = await api.get(`/consultations/${appointment._id}`);
      setPreviousConsultation(data);
    } catch {
      setPreviousConsultation(null);
    }
  }
  return (
    <>
      <Intro
        eyebrow={
          professional ? "Professional workspace" : "Your wellness space"
        }
        title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""}`}
      >
        {professional
          ? "Review your schedule and support patients with thoughtful, general wellness guidance."
          : "Keep your consultations and everyday wellness intentions in one place."}
      </Intro>
      <section className="page-body">
        <div className="wrap">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">
                {professional ? "Today and ahead" : "A little progress adds up"}
              </span>
              <h2>
                {professional ? "Professional dashboard" : "Your dashboard"}
              </h2>
            </div>
            <Link
              className="btn btn-primary btn-small"
              to={professional ? "/appointments" : "/professionals"}
            >
              {professional ? "View appointments" : "Find a professional"}{" "}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="stat-grid">
            <Stat
              label="Upcoming appointments"
              value={
                appointments.filter((a) => a.status !== "completed").length
              }
            />
            <Stat label="Wellness guides" value="08" />
            <Stat
              label="Activities today"
              value={Object.values(activities).filter(Boolean).length}
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <h2>
                {professional
                  ? "Appointment requests"
                  : "Upcoming appointments"}
              </h2>
              {appointments.length ? (
                appointments.map((item) => (
                  <div className="appointment-wrap" key={item._id}>
                    <div className="appointment">
                    <div>
                      <strong>
                        {professional
                          ? item.patientName || item.patientId?.name || "Patient"
                          : item.professionalName || item.professionalId?.name || item.professionalId?.userId?.name || "Professional"}
                      </strong>
                      <span>
                        {item.date} · {item.time} ·{" "}
                        {item.consultationType || "Video"}
                        {professional && item.patientId?.email ? ` · ${item.patientId.email}` : ""}
                      </span>
                    </div>
                    <span className={`status ${item.status}`}>
                      {item.status}
                    </span>
                    {!professional && (
                      <div className="payment-block">
                        {(() => {
                          const isDemoAppointment = user?.demo || String(item._id).startsWith("local-");
                          const paymentStatus = item.payment?.status || "unpaid"
                          const isBasicAppointment = !item.planId || item.planId === "basic" || item.planName === "Basic Consultation"
                          const fee = isBasicAppointment ? 99 : (item.payment?.amount ?? item.planPrice ?? 500)
                          const isPaid = paymentStatus === "paid"
                          const isPending = paymentStatus === "pending" || paymentStatus === "unpaid"
                          const paymentLabel = isPaid
                            ? "Payment Successful"
                            : paymentStatus === "pending"
                              ? "Payment Processing"
                              : paymentStatus === "failed"
                                ? "Payment Failed"
                                : paymentStatus === "cancelled"
                                  ? "Payment Cancelled"
                                  : paymentStatus === "refunded"
                                    ? "Payment Refunded"
                                    : "Unpaid";
                          return (
                            <>
                              <span className={`payment-badge ${isPaid ? "paid" : paymentStatus}`}>
                                {paymentLabel}
                              </span>
                              <span className="payment-fee"><strong>Consultation fee: ₹{fee}</strong></span>
                              {item.planName && <span className="payment-fee">Plan: {item.planName}</span>}
                              {isDemoAppointment && (
                                <>
                                  <span className="payment-fee">This is demo data and cannot be verified for payment.</span>
                                  {isBasicAppointment && (
                                    <a
                                      className="btn btn-primary btn-small"
                                      href={BASIC_CONSULTATION_PAYMENT_LINK}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Pay ₹99 Now
                                    </a>
                                  )}
                                  <Link className="btn btn-outline btn-small" to="/login">
                                    Sign in to create a payable appointment
                                  </Link>
                                </>
                              )}
                              {!isPaid && !isDemoAppointment && (
                                <>
                                  <button
                                    className="btn btn-primary btn-small"
                                    disabled={paymentBusy === item._id}
                                    onClick={() => payForAppointment(item)}
                                    type="button"
                                  >
                                    {paymentBusy === item._id
                                      ? "Opening Razorpay..."
                                      : isBasicAppointment
                                        ? `Pay ₹${fee} Now`
                                        : `Pay ₹${fee}`}
                                  </button>
                                  <Link
                                    className="btn btn-outline btn-small"
                                    to={`/payment/${item._id}`}
                                  >
                                    Pay with UPI QR
                                  </Link>
                                </>
                              )}
                              {isPaid && item.payment?.transactionId && (
                                <span className="payment-transaction">Transaction: {item.payment.transactionId}</span>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {paymentMessage && !professional && (
                      <div className="payment-message">{paymentMessage}</div>
                    )}
                    {professional && item.status === "pending" && (
                      <>
                        <button
                          className="btn btn-quiet btn-small"
                          onClick={() => changeStatus(item, "accepted")}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => changeStatus(item, "rejected")}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {item.status === "accepted" && (
                      professional ? (
                        item.payment?.status === "paid" ? (
                          isAppointmentJoinable(item) ? (
                            <Link className="btn btn-primary btn-small" to={`/consultation/${item._id}`}>
                              <Video size={14} /> Join Video Consultation
                            </Link>
                          ) : (
                            <span className="payment-fee">Join opens 15 minutes before the appointment</span>
                          )
                        ) : (
                          <span className="payment-fee">Locked — awaiting patient payment verification</span>
                        )
                      ) : item.payment?.status === "paid" ? (
                        isAppointmentJoinable(item) ? (
                          <Link className="btn btn-primary btn-small" to={`/consultation/${item._id}`}>
                            <Video size={14} /> Join Video Consultation
                          </Link>
                        ) : (
                          <span className="payment-fee">Join opens 15 minutes before the appointment</span>
                        )
                      ) : (
                        <Link className="btn btn-outline btn-small" to={`/payment/${item._id}`}>
                          Locked — Pay ₹99
                        </Link>
                      )
                    )}
                    {professional && item.status === "accepted" && (
                      <>
                        <button className="btn btn-quiet btn-small" onClick={() => {
                          setNoteAppointment(noteAppointment === item._id ? "" : item._id);
                          setNoteMessage("");
                        }}>Add guidance</button>
                        <button className="btn btn-outline btn-small" onClick={() => changeStatus(item, "completed")}>Mark complete</button>
                      </>
                    )}
                    </div>
                    {professional && noteAppointment === item._id && (
                      <form className="guidance-form" onSubmit={(event) => saveGuidance(event, item)}>
                        <label className="field">
                          <span>Consultation notes</span>
                          <textarea value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} />
                        </label>
                        <label className="field">
                          <span>General wellness guidance (not a prescription)</span>
                          <textarea
                            value={guidance}
                            maxLength={5000}
                            onChange={(event) => setGuidance(event.target.value)}
                            required
                          />
                        </label>
                        <fieldset className="recommendation-options">
                          <legend>Recommend educational topics</legend>
                          {categories.map((category) => (
                            <label key={category}>
                              <input type="checkbox" checked={recommendedCategories.includes(category)} onChange={() => setRecommendedCategories((selected) => selected.includes(category) ? selected.filter((item) => item !== category) : [...selected, category])} />
                              {category}
                            </label>
                          ))}
                        </fieldset>
                        {noteMessage && <div className="success">{noteMessage}</div>}
                        <button className="btn btn-primary btn-small">Save guidance</button>
                      </form>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">
                  No appointments yet. Choose a professional to get started.
                </div>
              )}
            </section>
            <aside className="panel">
              <h2>Keep your wellbeing in view</h2>
              <p className="muted">
                Small, steady habits can be a helpful part of everyday
                wellbeing.
              </p>
              <div className="appointment">
                <label className="activity-check">
                  <input
                    type="checkbox"
                    checked={Boolean(activities.movement)}
                    onChange={() => toggleActivity("movement")}
                  />
                  <Leaf size={15} /> Gentle movement
                </label>
                <span className="status">
                  {activities.movement ? "Done today" : "Not yet"}
                </span>
              </div>
              <div className="appointment">
                <label className="activity-check">
                  <input
                    type="checkbox"
                    checked={Boolean(activities.mindfulness)}
                    onChange={() => toggleActivity("mindfulness")}
                  />
                  <Heart size={15} /> Mindful pause
                </label>
                <span className="status">
                  {activities.mindfulness ? "Done today" : "Not yet"}
                </span>
              </div>
              <Link className="text-link" to="/wellness">
                Explore wellness library <ArrowRight size={14} />
              </Link>
            </aside>
          </div>
          {!professional && appointments.some((item) => item.status === "completed") && (
            <section className="panel previous-panel">
              <h2>Previous consultations</h2>
              {appointments.filter((item) => item.status === "completed").map((item) => (
                <div className="appointment" key={item._id}>
                  <div>
                    <strong>{item.professionalName || item.professionalId?.name || item.professionalId?.userId?.name || "Professional"}</strong>
                    <span>{item.date} · {item.consultationType || "Video"}</span>
                  </div>
                  <span className="status">Completed</span>
                  <button className="btn btn-quiet btn-small" onClick={() => viewPrevious(item)}>{previousConsultationId === item._id ? "Hide guidance" : "View guidance"}</button>
                  {previousConsultationId === item._id && (
                    <div className="previous-guidance">
                      {previousConsultation ? <>
                        {previousConsultation.notes && <p><strong>Notes:</strong> {previousConsultation.notes}</p>}
                        <p>{previousConsultation.guidance || "No additional guidance was recorded."}</p>
                        {previousConsultation.recommendedCategories?.length > 0 && <p><strong>Explore:</strong> {previousConsultation.recommendedCategories.join(", ")}</p>}
                      </> : <p>No guidance was recorded for this consultation.</p>}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
          <div className="notice">
            Demo appointments are stored in this browser only. For urgent
            symptoms, contact local emergency services.
          </div>
        </div>
      </section>
    </>
  );
}
function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AppointmentPayment({ user }) {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qrPayment, setQrPayment] = useState(null);
  const [gateway, setGateway] = useState({ configured: false, mode: "checking" });

  const loadPayment = useCallback(async () => {
    if (!localStorage.getItem("tw-token")) return;
    try {
      const [appointmentsResult, paymentResult] = await Promise.all([
        api.get("/appointments"),
        api.get(`/payments/${id}`),
      ]);
      const selected = appointmentsResult.data.find((item) => item._id === id);
      if (!selected) {
        setMessage("Appointment not found.");
        return;
      }
      setAppointment({
        ...selected,
        payment: paymentResult.data.status ? paymentResult.data : selected.payment,
      });
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not load payment details.");
    }
  }, [id]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  useEffect(() => {
    api
      .get("/payments/config/key")
      .then(({ data }) => setGateway(data))
      .catch(() => setGateway({ configured: false, mode: "not-configured" }));
  }, []);

  useEffect(() => {
    if (!appointment || appointment.payment?.status === "paid") return undefined;
    const isBasic = appointment.planId === "basic" || !appointment.planId || appointment.planName === "Basic Consultation";
    if (!isBasic) return undefined;
    const poll = async () => {
      try {
        const { data } = await api.post("/payments/payment-link/basic/status", { appointmentId: id });
        if (data.status === "paid") {
          await loadPayment();
          setMessage("Payment verified successfully.");
        }
      } catch {
        // The verified status remains authoritative when no payment-link payment is confirmed.
      }
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => window.clearInterval(timer);
  }, [appointment, id, loadPayment]);

  useEffect(() => {
    if (!qrPayment?.qrCodeId || appointment?.payment?.status === "paid") return undefined;
    const poll = async () => {
      try {
        const { data } = await api.post("/payments/qr/status", { appointmentId: id });
        if (data.status === "paid") {
          await loadPayment();
          setMessage("Payment verified successfully.");
        }
      } catch {
        // Keep the QR visible; webhook or a manual reload will reconcile the payment.
      }
    };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => window.clearInterval(timer);
  }, [appointment?.payment?.status, id, loadPayment, qrPayment?.qrCodeId]);

  async function generateQr() {
    if (!appointment || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { data } = await api.post("/payments/qr", { appointmentId: id });
      setQrPayment(data);
      setMessage("Scan the appointment-specific QR with GPay, PhonePe, Paytm, or another supported UPI app.");
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not generate the payment QR.");
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    if (!appointment || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const isBasic = appointment?.planId === "basic" || !appointment?.planId || appointment?.planName === "Basic Consultation";
      if (isBasic) {
        window.open(BASIC_CONSULTATION_PAYMENT_LINK, "_blank", "noopener,noreferrer");
        setMessage("Payment link opened. A successful redirect does not change payment status.");
        setBusy(false);
        return;
      }
      const scriptLoaded = await new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      if (!scriptLoaded) throw new Error("Could not load Razorpay Checkout.");

      const { data } = await api.post("/payments/orders", { appointmentId: id });
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "TeleWellness",
        description: appointment?.planName || "Basic Consultation",
        order_id: data.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#246a56" },
        handler: async (response) => {
          try {
            await api.post("/payments/verify", {
              appointmentId: id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await loadPayment();
            setMessage("Payment verified successfully.");
          } catch (error) {
            setMessage(error.response?.data?.message || "Payment verification failed.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: async () => {
            await api.post("/payments/failure", { appointmentId: id, reason: "Checkout cancelled by patient", status: "cancelled" }).catch(() => {});
            await loadPayment();
            setMessage("Payment cancelled. No payment was confirmed.");
            setBusy(false);
          },
        },
      });
      checkout.on("payment.failed", async (response) => {
        await api.post("/payments/failure", {
          appointmentId: id,
          reason: response.error?.description || "Payment failed",
          status: "failed",
        }).catch(() => {});
        await loadPayment();
        setMessage("Payment failed. Please try again.");
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not start payment.");
      setBusy(false);
    }
  }

  const doctorName = appointment?.professionalId?.userId?.name ||
    appointment?.professionalName ||
    "Dr. Maya Chen";
  const status = appointment?.payment?.status === "paid"
    ? "Paid"
    : appointment?.payment?.status === "failed"
      ? "Failed"
      : appointment?.payment?.status === "cancelled"
        ? "Cancelled"
        : appointment?.payment?.status === "refunded"
          ? "Refunded"
          : appointment?.payment?.status === "pending"
            ? "Payment Processing"
            : "Unpaid";
  const fee = appointment?.planId === "basic" || !appointment?.planId
    ? 99
    : appointment?.planPrice || appointment?.payment?.amount || 99;

  return (
    <>
      <Intro eyebrow="Secure test payment" title="Appointment Payment">
        Complete your consultation payment through Razorpay Checkout.
      </Intro>
      <section className="page-body">
        <div className="wrap payment-page-wrap">
          <article className="payment-page-card">
            <div className="payment-page-details">
              <span className="eyebrow">Appointment details</span>
              <h2>{doctorName}</h2>
              <div className="payment-detail-row"><span>Consultation plan</span><strong>{appointment?.planName || "Basic Consultation"}</strong></div>
              <div className="payment-detail-row"><span>Duration</span><strong>{appointment?.planDuration || 15} minutes</strong></div>
              <div className="payment-detail-row"><span>Fee</span><strong>₹{fee}</strong></div>
              <div className="payment-detail-row">
                <span>Payment status</span>
                <span className={`payment-badge ${status === "Paid" ? "paid" : status === "Failed" || status === "Cancelled" ? "failed" : "unpaid"}`}>{status}</span>
              </div>
              {appointment?.payment?.paymentId && (
                <div className="payment-detail-row"><span>Payment ID</span><strong>{appointment.payment.paymentId}</strong></div>
              )}
            </div>
            <aside className="payment-methods">
              <h3>Choose a payment method</h3>
              <p>Select Google Pay, PhonePe, Paytm, another UPI app, card, or net banking in the official Razorpay Checkout.</p>
              <div className="upi-options" aria-label="Supported payment methods">
                <span>GPay</span><span>PhonePe</span><span>Paytm</span><span>Other UPI</span>
              </div>
              {!gateway.configured && gateway.mode !== "checking" && (
                <div className="payment-message">
                  UPI and other checkout methods require Razorpay test credentials and account activation.
                  Add the test Key ID and Key Secret to <strong>server/.env</strong>, then restart the backend.
                </div>
              )}
              <button
                className="btn btn-primary payment-pay-button"
                onClick={payNow}
                disabled={busy || status === "Paid" || (fee !== 99 && !gateway.configured && gateway.mode !== "checking")}
              >
                {busy ? "Opening secure checkout..." : status === "Paid" ? "Paid" : status === "Payment Processing" ? "Payment Processing" : `Pay ₹${fee} Now`}
              </button>
              <button className="btn btn-outline payment-pay-button" onClick={generateQr} disabled={busy || status === "Paid" || (!gateway.configured && gateway.mode !== "checking")}>
                {busy ? "Generating QR..." : "Pay with UPI QR"}
              </button>
              {qrPayment?.qrImageUrl && status !== "Paid" && (
                <div className="upi-payment-qr" aria-label="Appointment-specific UPI payment QR code">
                  <img src={qrPayment.qrImageUrl} alt={`Scan to pay ₹${fee} for this consultation`} />
                  <strong>₹{fee} UPI QR</strong>
                  <small>Waiting for verified payment… Keep this page open.</small>
                </div>
              )}
              {message && <div className="payment-message" role="status">{message}</div>}
              <small className="payment-security">TeleWellness never collects your UPI PIN or banking credentials.</small>
            </aside>
          </article>
        </div>
      </section>
    </>
  );
}

function Booking({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlanId = searchParams.get("plan") || "basic";
  const feePlans = {
    basic: { name: 'Basic Consultation', price: 99, duration: 15 },
    meditation: { name: 'Meditation Session', price: 49, duration: 15 },
    yoga: { name: 'Yoga Session', price: 79, duration: 30 },
    wellness: { name: 'Wellness Package', price: 199, duration: 60 },
  };
  const selectedPlan = feePlans[selectedPlanId] || feePlans.basic;
  const [person, setPerson] = useState(
    sampleProfessionals.find((item) => item._id === id) ||
      sampleProfessionals[0],
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (id.startsWith("pro-")) return;
    api
      .get(`/professionals/${id}`)
      .then(({ data }) => setPerson(data))
      .catch(() => {});
  }, [id]);
  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const appointment = {
      professionalId: id,
      date: form.get("date"),
      time: form.get("time"),
      consultationType: form.get("type"),
      planId: selectedPlanId,
    };
    if (user && !user.demo) {
      try {
        const { data } = await api.post("/appointments", appointment);
        nav(`/payment/${data._id}`);
        return;
      } catch (error) {
        setMessage(
          error.response?.data?.message || "Could not book this appointment.",
        );
        return;
      }
    }
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("tw-appointments") || "[]");
    } catch {
      saved = [];
    }
    saved.push({
      _id: `local-${Date.now()}`,
      ...appointment,
      patientName: user?.name || "Guest",
      professionalName: person.name,
      status: "pending",
      planId: selectedPlanId,
      planName: selectedPlan.name,
      planPrice: selectedPlan.price,
      planDuration: selectedPlan.duration,
      payment: { status: "unpaid", amount: selectedPlan.price },
    });
    localStorage.setItem("tw-appointments", JSON.stringify(saved));
    nav("/appointments");
  }
  return (
    <>
      <Intro
        eyebrow="Make time for your health"
        title={`Book a conversation with ${person.name}`}
      >
        Choose a time for an online consultation. This is a professional
        conversation, not an emergency service.
      </Intro>
      <section className="page-body narrow">
        <form className="panel" onSubmit={submit}>
          <h2>Consultation with {person.name}</h2>
          <div className="fee-selection">
            <div><strong>Selected plan:</strong> {selectedPlan.name}</div>
            <div><strong>Fee:</strong> ₹{selectedPlan.price}</div>
            <span className="payment-badge unpaid">Unpaid</span>
          </div>
          {!user && (
            <p className="notice">
              You can book in demo mode. <Link to="/login">Sign in</Link> to
              save appointments to your account.
            </p>
          )}
          <div className="field-row">
            <Field label="Date">
              <input name="date" type="date" min={currentDate} required />
            </Field>
            <Field label="Time">
              <select name="time" required defaultValue="">
                <option value="" disabled>
                  Select a time
                </option>
                {["09:00", "10:30", "12:00", "14:00", "15:30"].map((time) => (
                  <option key={time}>{time}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Consultation type">
            <select name="type">
              <option value="video">Video consultation</option>
              <option value="audio">Audio consultation</option>
            </select>
          </Field>
          {message && <div className="error">{message}</div>}
          <button className="btn btn-primary">
            Request appointment & continue to payment <CalendarDays size={16} />
          </button>
        </form>
      </section>
    </>
  );
}

function Profile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const planQuery = searchParams.get("plan");
  const [person, setPerson] = useState(
    sampleProfessionals.find((item) => item._id === id) ||
      sampleProfessionals[0],
  );
  useEffect(() => {
    if (id.startsWith("pro-")) return;
    api
      .get(`/professionals/${id}`)
      .then(({ data }) => setPerson(data))
      .catch(() => {});
  }, [id]);
  return (
    <>
      <Intro eyebrow="Professional profile" title={person.name}>
        {person.specialty} · {person.experience} of experience
      </Intro>
      <section className="page-body">
        <div className="wrap split">
          <div>
            <h2>A thoughtful partner in your wellbeing</h2>
            <p className="muted">{person.bio}</p>
            <p className="about-point">
              <Check size={16} /> Preventive wellness conversations
            </p>
            <p className="about-point">
              <Check size={16} /> General lifestyle and wellbeing guidance
            </p>
            <Link className="btn btn-primary" to={`/book/${person._id}${planQuery ? `?plan=${encodeURIComponent(planQuery)}` : ""}`}>
              Book a consultation <CalendarDays size={16} />
            </Link>
          </div>
          <div className="about-photo" />
        </div>
      </section>
    </>
  );
}

function VideoConsult({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState("Waiting for the other participant");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [error, setError] = useState("");
  const [accessStatus, setAccessStatus] = useState("checking");
  const [accessMessage, setAccessMessage] = useState("Verifying payment and appointment access...");
  useEffect(() => {
    api
      .get(`/consultations/${id}`)
      .then(() => setAccessStatus("authorized"))
      .catch((requestError) => {
        const status = requestError.response?.status;
        setAccessStatus(status === 402 ? "unpaid" : "denied");
        setAccessMessage(requestError.response?.data?.message || "You cannot access this consultation.");
      });
  }, [id]);
  useEffect(() => {
    if (accessStatus !== "authorized") return undefined;
    let stream;
    let active = true;
    let makingOffer = false;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localVideo.current.srcObject = stream;
        setLocalReady(true);
        const peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        peer.ontrack = (event) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = event.streams[0];
            setRemoteReady(true);
          }
        };
        peer.onicecandidate = ({ candidate }) =>
          candidate &&
          socketRef.current?.emit("webrtc:signal", {
            appointmentId: id,
            signal: { candidate },
          });
        peer.onconnectionstatechange = () =>
          setStatus(
            peer.connectionState === "connected"
              ? "Connected securely"
              : peer.connectionState,
          );
        const token = localStorage.getItem("tw-token");
        if (!token) {
          setStatus("Demo preview only. Sign in to join peer consultations.");
          return;
        }
        const socket = io("/", { auth: { token } });
        socketRef.current = socket;
        socket.on("connect", () => {
          socket.emit("consultation:join", { appointmentId: id });
          setStatus("Connected. Waiting for participant…");
        });
        socket.on("consultation:peer", async ({ initiator }) => {
          if (initiator) {
            makingOffer = true;
            try {
              await peer.setLocalDescription();
              socket.emit("webrtc:signal", {
                appointmentId: id,
                signal: { description: peer.localDescription },
              });
            } finally {
              makingOffer = false;
            }
          }
        });
        socket.on("webrtc:signal", async ({ signal }) => {
          try {
            if (signal.description) {
              if (
                signal.description.type === "offer" &&
                (makingOffer || peer.signalingState !== "stable")
              )
                return;
              await peer.setRemoteDescription(signal.description);
              if (signal.description.type === "offer") {
                await peer.setLocalDescription();
                socket.emit("webrtc:signal", {
                  appointmentId: id,
                  signal: { description: peer.localDescription },
                });
              }
            } else if (signal.candidate)
              await peer.addIceCandidate(signal.candidate);
          } catch {
            setStatus("Could not establish video connection");
          }
        });
        socket.on("connect_error", () =>
          setStatus("Signaling unavailable. Start the server and sign in."),
        );
        socket.on("consultation:error", ({ message }) => {
          setStatus("Access denied");
          setError(message);
        });
        socket.on("consultation:ended", () => {
          setStatus("Call ended");
          setRemoteReady(false);
          setError("The other participant ended the consultation.");
        });
      } catch (mediaError) {
        setError(
          mediaError.name === "NotAllowedError"
            ? "Allow camera and microphone access in your browser to join."
            : "Camera or microphone is unavailable. You can still review consultation details.",
        );
        setStatus("Media access needed");
      }
    }
    start();
    return () => {
      active = false;
      socketRef.current?.disconnect();
      peerRef.current?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [id, accessStatus]);
  function toggle(kind) {
    const track = localVideo.current?.srcObject
      ?.getTracks()
      .find((item) => item.kind === kind);
    if (track) track.enabled = !track.enabled;
    if (kind === "audio") setMuted(!muted);
    else setCameraOff(!cameraOff);
  }
  function endCall() {
    socketRef.current?.emit("consultation:end", { appointmentId: id });
    peerRef.current?.close();
    localVideo.current?.srcObject?.getTracks().forEach((track) => track.stop());
    socketRef.current?.disconnect();
    nav("/appointments");
  }
  return (
    <section className="video-wrap">
      <div className="wrap">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Online consultation</span>
            <h1>Your private conversation</h1>
            <p className="muted">
              Appointment {id} · {user?.name || "Guest participant"}
            </p>
          </div>
          <span className="connection">
            <i className={status === "Connected securely" ? "connected" : ""} />
            {status}
          </span>
        </div>
        {error && <div className="notice">{error}</div>}
        {accessStatus !== "authorized" && (
          <div className="consultation-lock panel">
            <span className="connection-lock">Locked — Complete payment to join</span>
            <h2>{accessStatus === "checking" ? "Verifying consultation access" : "Video consultation unavailable"}</h2>
            <p>{accessMessage}</p>
            {accessStatus === "unpaid" && (
              <Link className="btn btn-primary" to={`/payment/${id}`}>
                <ShieldCheck size={16} /> Pay ₹99
              </Link>
            )}
            <Link className="btn btn-outline" to="/appointments">
              Back to appointments
            </Link>
          </div>
        )}
        {accessStatus === "authorized" && (
        <div className="video-stage">
          <div className="video-pane">
            <video ref={remoteVideo} autoPlay playsInline />
            {!remoteReady && <span className="video-placeholder">Professional video</span>}
            <label>Professional</label>
          </div>
          <div className="video-pane">
            <video ref={localVideo} autoPlay muted playsInline />
            {!localReady && <span className="video-placeholder">Your video</span>}
            <label>{user?.name || "You"}</label>
          </div>
          <div className="call-controls">
            <button
              className={muted ? "off" : ""}
              aria-label="Toggle microphone"
              onClick={() => toggle("audio")}
            >
              {muted ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
            <button
              className={cameraOff ? "off" : ""}
              aria-label="Toggle camera"
              onClick={() => toggle("video")}
            >
              {cameraOff ? <CameraOff size={19} /> : <Camera size={19} />}
            </button>
            <button
              className="hangup"
              aria-label="End call"
              onClick={endCall}
            >
              <PhoneOff size={19} />
            </button>
          </div>
        </div>
        )}
        <div className="panel info-panel">
          <h2>Consultation information</h2>
          <p>
            This conversation supports professional guidance and everyday
            wellness. It is not emergency care. If you need urgent help, contact
            local emergency services.
          </p>
        </div>
      </div>
    </section>
  );
}

function Admin({ user }) {
  const [tab, setTab] = useState("Wellness content");
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tw-admin-content")) || sampleContent;
    } catch {
      return sampleContent;
    }
  });
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tw-appointments") || "[]");
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [resource, setResource] = useState({
    title: "",
    category: "Nutrition",
    description: "",
    videoUrl: "",
  });
  useEffect(() => {
    if (!localStorage.getItem("tw-token")) return;
    api
      .get("/admin/users")
      .then(({ data }) => setUsers(data))
      .catch(() => {});
    api
      .get("/admin/appointments")
      .then(({ data }) => setAppointments(data))
      .catch(() => {});
    api
      .get("/wellness")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) setItems(data);
      })
      .catch(() => {});
  }, []);
  function clearResourceForm() {
    setEditingId("");
    setResource({ title: "", category: "Nutrition", description: "", videoUrl: "" });
  }
  function startEditing(item) {
    setEditingId(item._id);
    setResource({
      title: item.title || "",
      category: item.category || "Nutrition",
      description: item.description || "",
      videoUrl: item.videoUrl || "",
    });
  }
  async function saveResource(event) {
    event.preventDefault();
    const isDemo = user?.demo || !localStorage.getItem("tw-token");
    if (editingId) {
      if (isDemo || String(editingId).startsWith("local-")) {
        const updated = items.map((item) => item._id === editingId ? { ...item, ...resource } : item);
        setItems(updated);
        localStorage.setItem("tw-admin-content", JSON.stringify(updated));
        setMessage("Wellness resource updated in this browser.");
      } else {
        try {
          const { data } = await api.put(`/admin/wellness/${editingId}`, resource);
          setItems(items.map((item) => item._id === editingId ? data : item));
          setMessage("Wellness resource updated.");
        } catch (error) {
          setMessage(error.response?.data?.message || "Could not update this resource.");
          return;
        }
      }
    } else if (isDemo) {
      const updated = [{ ...resource, _id: `local-${Date.now()}` }, ...items];
      setItems(updated);
      localStorage.setItem("tw-admin-content", JSON.stringify(updated));
      setMessage("Wellness resource added to this browser.");
    } else {
      try {
        const { data } = await api.post("/admin/wellness", resource);
        setItems([data, ...items]);
        setMessage("Wellness resource added.");
      } catch (error) {
        setMessage(error.response?.data?.message || "Could not add this resource.");
        return;
      }
    }
    clearResourceForm();
  }
  async function remove(item) {
    if (user?.demo || !localStorage.getItem("tw-token") || String(item._id).startsWith("local-")) {
      const updated = items.filter((entry) => entry._id !== item._id);
      setItems(updated);
      localStorage.setItem("tw-admin-content", JSON.stringify(updated));
      return;
    }
    try {
      await api.delete(`/admin/wellness/${item._id}`);
      setItems(items.filter((entry) => entry._id !== item._id));
    } catch {
      setMessage("Could not delete this resource.");
    }
  }
  async function toggleUser(userItem) {
    try {
      const { data } = await api.put(`/admin/users/${userItem._id}`, {
        active: !userItem.active,
      });
      setUsers(users.map((item) => item._id === data._id ? data : item));
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not update this account.");
    }
  }
  async function updateAppointment(item, status) {
    let updatedAppointment = { ...item, status };
    if (!user?.demo && localStorage.getItem("tw-token")) {
      try {
        const { data } = await api.put(`/appointments/${item._id}`, { status });
        updatedAppointment = data;
      } catch (error) {
        setMessage(error.response?.data?.message || "Could not update this appointment.");
        return;
      }
    }
    const updated = appointments.map((entry) => entry._id === item._id ? updatedAppointment : entry);
    setAppointments(updated);
    localStorage.setItem("tw-appointments", JSON.stringify(updated));
  }
  return (
    <>
      <Intro eyebrow="Platform administration" title="Admin dashboard">
        Manage people, appointments, and educational wellness resources.
      </Intro>
      <section className="page-body">
        <div className="wrap admin-layout">
          <nav className="admin-nav">
            {[
              "Wellness content",
              "Patients & professionals",
              "Appointments",
            ].map((name) => (
              <button
                className={tab === name ? "selected" : ""}
                key={name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </nav>
          <div>
            {user?.demo && (
              <div className="notice">
                Demo admin view. Changes are local to this browser.
              </div>
            )}
            {message && <div className="success">{message}</div>}
            {tab === "Wellness content" ? (
              <>
                <form className="panel" onSubmit={saveResource}>
                  <h2>{editingId ? "Edit educational resource" : "Add educational resource"}</h2>
                  <div className="field-row">
                    <Field label="Title">
                      <input name="title" value={resource.title} onChange={(event) => setResource({ ...resource, title: event.target.value })} required />
                    </Field>
                    <Field label="Category">
                      <select name="category" value={resource.category} onChange={(event) => setResource({ ...resource, category: event.target.value })}>
                        {categories.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea name="description" value={resource.description} onChange={(event) => setResource({ ...resource, description: event.target.value })} required />
                  </Field>
                  <Field label="Video or article URL">
                    <input name="videoUrl" type="url" value={resource.videoUrl} onChange={(event) => setResource({ ...resource, videoUrl: event.target.value })} />
                  </Field>
                  <Field label="Image URL (optional)">
                    <input name="imageUrl" type="url" value={resource.imageUrl || ""} onChange={(event) => setResource({ ...resource, imageUrl: event.target.value })} />
                  </Field>
                  <button className="btn btn-primary btn-small">
                    {editingId ? "Save changes" : "Add resource"}
                  </button>
                  {editingId && <button type="button" className="btn btn-outline btn-small" onClick={clearResourceForm}>Cancel</button>}
                </form>
                <div className="panel admin-list">
                  <h2>Current resources</h2>
                  {items.map((item) => (
                    <div className="appointment" key={item._id || item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.category}</span>
                      </div>
                      <div className="admin-actions">
                        <button type="button" className="btn btn-quiet btn-small" onClick={() => startEditing(item)}>Edit</button>
                        <button type="button" className="btn btn-outline btn-small" onClick={() => remove(item)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : tab === "Patients & professionals" ? (
              <div className="panel">
                <h2>Registered users</h2>
                {users.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Manage</th></tr></thead>
                      <tbody>{users.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td><td>{item.email}</td><td>{item.role}</td>
                          <td>{item.active ? "Active" : "Inactive"}</td>
                          <td><button className="btn btn-outline btn-small" onClick={() => toggleUser(item)}>{item.active ? "Deactivate" : "Activate"}</button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    Sign in with configured administrator credentials to view
                    user records.
                  </div>
                )}
              </div>
            ) : (
              <div className="panel">
                <h2>Appointments</h2>
                {appointments.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Patient</th><th>Professional</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>{appointments.map((item) => (
                        <tr key={item._id}>
                          <td>{item.patientName || item.patientId?.name || "Patient"}</td>
                          <td>{item.professionalName || item.professionalId?.name || item.professionalId?.userId?.name || "Professional"}</td>
                          <td>{item.date?.slice(0, 10)}</td>
                          <td><select aria-label={`Status for ${item.patientName || item.patientId?.name || "appointment"}`} value={item.status} onChange={(event) => updateAppointment(item, event.target.value)}>{["pending", "accepted", "rejected", "completed", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">No appointments to display.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
function About() {
  return (
    <>
      <Intro eyebrow="Our approach" title="Care that sees the whole person">
        Health is shaped by more than a single appointment. We make it easier to
        have informed conversations and explore sustainable everyday habits.
      </Intro>
      <section className="page-body">
        <div className="wrap split">
          <div>
            <span className="eyebrow">A people-first platform</span>
            <h2>A place for better questions and practical next steps.</h2>
            <p className="muted">
              TeleWellness connects people with professionals for online
              consultations and brings educational wellness ideas together in
              one approachable library. Our materials are general education, not
              individualized medical advice.
            </p>
            <p className="about-point">
              <Check size={16} /> Professional conversations
            </p>
            <p className="about-point">
              <Check size={16} /> Accessible wellness education
            </p>
            <p className="about-point">
              <Check size={16} /> No medicine sales or prescriptions
            </p>
          </div>
          <div className="about-photo" />
        </div>
      </section>
    </>
  );
}
function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <>
      <Intro eyebrow="Get in touch" title="We’re here to help">
        Questions about using the platform? Send a note to our team.
      </Intro>
      <section className="page-body">
        <div className="wrap contact-grid">
          <div>
            <div className="panel contact-item">
              <Mail size={19} />
              <div>
                <b>Email</b>
                <span>hello@telewellness.example</span>
              </div>
            </div>
            <p className="notice">
              For urgent symptoms, contact local emergency services. This form
              is not monitored for emergencies.
            </p>
          </div>
          <form
            className="panel"
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
              event.currentTarget.reset();
            }}
          >
            <h2>Send us a message</h2>
            <div className="field-row">
              <Field label="Name">
                <input required />
              </Field>
              <Field label="Email">
                <input type="email" required />
              </Field>
            </div>
            <Field label="Message">
              <textarea required />
            </Field>
            {sent && (
              <div className="success">
                Thanks. Your message has been recorded in this demo.
              </div>
            )}
            <button className="btn btn-primary">
              Send message <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
function NotFound() {
  return (
    <section className="page-body">
      <div className="wrap">
        <h1>Page not found</h1>
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}

function AppRoutes({ user, signIn }) {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Auth signIn={signIn} />} />
      <Route path="/register" element={<Auth register signIn={signIn} />} />
      <Route path="/dashboard" element={<Dashboard user={user} />} />
      <Route path="/appointments" element={<Dashboard user={user} />} />
      <Route path="/professionals" element={<Professionals />} />
      <Route path="/professionals/:id" element={<Profile />} />
      <Route path="/book/:id" element={<Booking user={user} />} />
      <Route path="/payment/:id" element={<AppointmentPayment user={user} />} />
      <Route path="/consultation/:id" element={<VideoConsult user={user} />} />
      <Route path="/wellness" element={<Wellness user={user} />} />
      <Route path="/wellness/:category" element={<Wellness user={user} />} />
      <Route path="/fees" element={<FeeStructure user={user} />} />
      <Route
        path="/nutrition"
        element={<Wellness fixedCategory="Nutrition" />}
      />
      <Route path="/yoga" element={<Wellness fixedCategory="Yoga" />} />
      <Route
        path="/meditation"
        element={<Wellness fixedCategory="Meditation" user={user} />}
      />
      <Route path="/exercise" element={<Wellness fixedCategory="Exercise" />} />
      <Route path="/admin" element={<Admin user={user} />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
export default function TeleWellnessApp() {
  const session = useUser();
  return (
    <BrowserRouter>
      <Shell user={session.user} signOut={session.signOut}>
        <main>
          <AppRoutes user={session.user} signIn={session.signIn} />
        </main>
      </Shell>
    </BrowserRouter>
  );
}
