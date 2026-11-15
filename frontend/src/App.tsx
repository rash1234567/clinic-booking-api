import { useState } from "react";
import {
  getSlots,
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  setApiKey as saveApiKey,
  clearApiKey,
} from "./services/api";
import type { Slot, Booking } from "./services/api";
import "./App.css";
import AdminSlotManager from "./components/AdminSlotManager";


function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginKey, setLoginKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [hasSearchedBookings, setHasSearchedBookings] = useState(false);




  async function loadSlots() {
    try {
      setLoading(true);
      setError("");

      const data = await getSlots();
      setSlots(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load appointments."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoginLoading(true);
      setLoginError("");

      saveApiKey(loginKey);

      const data = await getSlots();

      setSlots(data);
      setAuthenticated(true);
      setLoginKey("");
    } catch {
      clearApiKey();
      setLoginError(
        "Unable to authenticate. Check your API key and try again."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearApiKey();

    setAuthenticated(false);
    setSlots([]);
    setSelectedSlot(null);
    setConfirmation(null);
    setMyBookings([]);
    setSelectedBooking(null);
    setSearchEmail("");
    setError("");
    setBookingsError("");
    setHasSearchedBookings(false);
  }

  async function loadMyBookings(cursor?: string) {
    if (!searchEmail.trim()) {
      setBookingsError("Please enter your email address.");
      return;
    }

    try {
      setBookingsLoading(true);
      setBookingsError("");

      const result = await getBookings(searchEmail.trim(), 10, cursor);

      const activeBookings = result.bookings.filter(
        (booking) => booking.status === "confirmed"
      );

      setMyBookings((previous) =>
        cursor ? [...previous, ...activeBookings] : activeBookings
      );

      setHasSearchedBookings(true);
      setNextCursor(result.next_cursor);
      setSelectedBooking(null);
    } catch (err) {
      setBookingsError(
        err instanceof Error ? err.message : "Unable to load bookings."
      );
    } finally {
      setBookingsLoading(false);
    }
  }

  async function handleViewBooking(id: string) {
    try {
      setBookingsError("");

      const booking = await getBooking(id);
      setSelectedBooking(booking);
    } catch (err) {
      setBookingsError(
        err instanceof Error ? err.message : "Unable to retrieve booking."
      );
    }
  }

  async function handleCancelBooking(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    try {
      setBookingsError("");

      await cancelBooking(id);

      setMyBookings((previous) =>
        previous.filter((booking) => booking.id !== id)
      );

      setSelectedBooking(null);
      setShowCancellationModal(true);

      await loadSlots();
    } catch (err) {
      setBookingsError(
        err instanceof Error ? err.message : "Unable to cancel booking."
      );
    }
  }

  async function handleBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSlot) {
      setError("Please select an appointment first.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const booking = await createBooking({
        slot_id: selectedSlot.id,
        name,
        email,
      });

      setConfirmation(booking);
      setSelectedSlot(null);
      setName("");
      setEmail("");

      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
      await loadSlots();
    } finally {
      setSubmitting(false);
    }
  }

 

 

 

 

  if (!authenticated) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <span className="brand-icon">+</span>
            <span>CarePoint</span>
          </div>

          <p className="eyebrow">WELCOME</p>
          <h2>Access your appointment portal</h2>
          <p>Enter your API key to continue.</p>

          <form onSubmit={handleLogin}>
            <label htmlFor="login-key">API key</label>

            <input
              id="login-key"
              type="password"
              placeholder="Enter your API key"
              value={loginKey}
              onChange={(event) => setLoginKey(event.target.value)}
              required
            />

            {loginError && <p className="error-message">{loginError}</p>}

            <button
              type="submit"
              className="primary-button"
              disabled={loginLoading}
            >
              {loginLoading ? "Verifying..." : "Continue"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">+</span>
          <span>CarePoint</span>
        </div>

        <div className="header-actions">
          <span className="header-label">Appointment Booking</span>
          <button
            type="button"
            className="cancel-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR HEALTH MATTERS</p>
        <h1>Book your appointment.</h1>
        <p className="hero-description">
          Choose a healthcare provider and find a time that works for you.
        </p>
      </section>

      {confirmation && (
        <section className="confirmation">
          <div className="success-icon">✓</div>
          <h2>Appointment confirmed!</h2>

          <p>
            Thank you, {confirmation.name}. Your appointment has been booked
            successfully.
          </p>

          <div className="confirmation-details">
            <p>
              <strong>Booking ID:</strong> {confirmation.id}
            </p>
            <p>
              <strong>Provider:</strong>{" "}
              {slots.find((slot) => slot.id === confirmation.slot_id)
                ?.provider ?? confirmation.slot_id}
            </p>
            <p>
              <strong>Email:</strong> {confirmation.email}
            </p>
            <p>
              <strong>Status:</strong> {confirmation.status}
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setConfirmation(null)}
          >
            Book another appointment
          </button>
        </section>
      )}

      {!confirmation && (
        <div className="booking-layout">
          <section className="slots-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AVAILABLE TIMES</p>
                <h2>Choose a time</h2>
              </div>

              <button
                className="refresh-button"
                onClick={loadSlots}
                disabled={loading}
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="message">Loading appointments...</p>
            ) : slots.filter((slot) => slot.available).length === 0 ? (
              <p className="message">
                No slots are currently available.
              </p>
            ) : (
              <div className="slot-list">
                {slots
                  .filter((slot) => slot.available)
                  .map((slot) => (
                    <button
                      key={slot.id}
                      className={`slot-card ${
                        selectedSlot?.id === slot.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setError("");
                      }}
                    >
                      <span className="slot-provider">{slot.provider}</span>

                      <span className="slot-date">
                        {new Date(slot.start).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>

                      <span className="slot-time">
                        {new Date(slot.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>

                      <span className="slot-indicator">
                        {selectedSlot?.id === slot.id ? "✓" : "+"}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </section>

          <section className="form-section">
            <p className="eyebrow">YOUR DETAILS</p>
            <h2>Complete your booking</h2>

            <p className="form-description">
              Enter your details to reserve your selected appointment.
            </p>

            {selectedSlot && (
              <div className="selected-summary">
                <strong>{selectedSlot.provider}</strong>
                <span>{new Date(selectedSlot.start).toLocaleString()}</span>
              </div>
            )}

            <form onSubmit={handleBooking}>
              <label htmlFor="booking-name">Full name</label>
              <input
                id="booking-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />

              <label htmlFor="booking-email">Email address</label>
              <input
                id="booking-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              {error && <p className="error-message">{error}</p>}

              <button
                type="submit"
                className="primary-button"
                disabled={!selectedSlot || submitting}
              >
                {submitting ? "Booking..." : "Confirm appointment"}
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="my-bookings-section form-section">
        <p className="eyebrow">MANAGE YOUR APPOINTMENTS</p>
        <h2>My Bookings</h2>

        <p className="form-description">
          Enter the email address you used when booking to find your
          appointments.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMyBookings([]);
            setNextCursor(null);
            setSelectedBooking(null);
            loadMyBookings();
          }}
          className="my-bookings-form"
        >
          <label htmlFor="search-email">Email address</label>

          <input
            id="search-email"
            type="email"
            placeholder="you@example.com"
            value={searchEmail}
            onChange={(event) => {
              setSearchEmail(event.target.value);
              setMyBookings([]);
              setHasSearchedBookings(false);
              setNextCursor(null);
              setSelectedBooking(null);
            }}
            required
          />

          <button
            type="submit"
            className="primary-button"
            disabled={bookingsLoading}
          >
            {bookingsLoading ? "Searching..." : "Find my bookings"}
          </button>
        </form>

        {bookingsError && <p className="error-message">{bookingsError}</p>}

        {myBookings.length > 0 && (
          <div className="my-bookings-list">
            <h3>Your appointments</h3>

            {myBookings.map((booking) => (
              <div className="my-booking-card" key={booking.id}>
                <div>
                  <strong>{booking.name}</strong>
                  <p>{booking.email}</p>
                  <p>Booking ID: {booking.id}</p>
                  <p>Status: {booking.status}</p>
                </div>

                <div className="booking-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleViewBooking(booking.id)}
                  >
                    View details
                  </button>

                  {booking.status === "confirmed" && (
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => handleCancelBooking(booking.id)}
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </div>
            ))}

            {nextCursor && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => loadMyBookings(nextCursor)}
                disabled={bookingsLoading}
              >
                {bookingsLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}

        {selectedBooking && (
          <div className="booking-detail">
            <h3>Booking details</h3>
            <p>
              <strong>Booking ID:</strong> {selectedBooking.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedBooking.name}
            </p>
            <p>
              <strong>Email:</strong> {selectedBooking.email}
            </p>
            <p>
              <strong>Slot ID:</strong> {selectedBooking.slot_id}
            </p>
            <p>
              <strong>Status:</strong> {selectedBooking.status}
            </p>
            <p>
              <strong>Created:</strong>{" "}
              {new Date(selectedBooking.created_at).toLocaleString()}
            </p>
          </div>
        )}

        {myBookings.length === 0 && !bookingsLoading && !bookingsError && (
          <p className="message">
            {hasSearchedBookings
              ? "No bookings found for this email address."
              : "Search using your email to see your appointments."}
          </p>
        )}
      </section>

      {showCancellationModal && (
        <div className="modal-overlay">
          <div
            className="success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="success-icon">✓</div>

            <h2 id="cancel-modal-title">Appointment cancelled</h2>

            <p>Your appointment has been successfully cancelled.</p>

            <button
              className="primary-button"
              onClick={() => setShowCancellationModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <AdminSlotManager onSaved={loadSlots} />

      <footer>
        <p>CarePoint · Making healthcare appointments easier.</p>
      </footer>
    </main>
  );
}

export default App;
